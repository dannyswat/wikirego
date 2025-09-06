package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/keymgmt"
	"wikirego/internal/users"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type Fido2Handler struct {
	UserService  *users.UserService
	WebAuthn     *webauthn.WebAuthn
	KeyStore     *keymgmt.KeyMgmtService
	SessionStore *SessionStore
	RateLimiter  *apihelper.RateLimiter
}

// Simple in-memory session store for WebAuthn sessions
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*SessionData
}

type SessionData struct {
	Data      *webauthn.SessionData
	ExpiresAt time.Time
}

func NewSessionStore() *SessionStore {
	store := &SessionStore{
		sessions: make(map[string]*SessionData),
	}
	// Start cleanup goroutine
	go store.cleanup()
	return store
}

func (s *SessionStore) Set(key string, data *webauthn.SessionData, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = &SessionData{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
}

func (s *SessionStore) Get(key string) *webauthn.SessionData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, exists := s.sessions[key]
	if !exists || time.Now().After(session.ExpiresAt) {
		return nil
	}
	return session.Data
}

func (s *SessionStore) Delete(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, key)
}

func (s *SessionStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for key, session := range s.sessions {
			if now.After(session.ExpiresAt) {
				delete(s.sessions, key)
			}
		}
		s.mu.Unlock()
	}
}

// WebAuthnUser wraps User to implement webauthn.User interface
type WebAuthnUser struct {
	*users.User
	devices []*users.UserDevice
}

func (u WebAuthnUser) WebAuthnID() []byte {
	return []byte(strconv.Itoa(u.ID))
}

func (u WebAuthnUser) WebAuthnName() string {
	return u.UserName
}

func (u WebAuthnUser) WebAuthnDisplayName() string {
	return u.UserName
}

func (u WebAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	credentials := make([]webauthn.Credential, len(u.devices))
	for i, device := range u.devices {
		credentialID, _ := base64.StdEncoding.DecodeString(device.CredentialID)
		publicKey, _ := base64.StdEncoding.DecodeString(device.PublicKey)

		credentials[i] = webauthn.Credential{
			ID:        credentialID,
			PublicKey: publicKey,
			Authenticator: webauthn.Authenticator{
				AAGUID:       []byte(device.AAGUID),
				SignCount:    device.SignCount,
				CloneWarning: false,
				Attachment:   "",
			},
			Flags: webauthn.CredentialFlags{
				UserPresent:    true,
				UserVerified:   true,
				BackupEligible: device.BackupEligible,
				BackupState:    device.BackupState,
			},
		}
	}
	return credentials
}

func (u WebAuthnUser) WebAuthnIcon() string {
	return ""
}

// BeginRegistration starts the passkey registration process
func (h *Fido2Handler) BeginRegistration(e echo.Context) error {
	username := apihelper.GetUserId(e)
	if username == "" {
		return errors.Unauthorized("unauthorized")
	}

	user, err := h.UserService.DB.GetUserByUserName(username)
	if err != nil {
		return err
	}

	devices, err := h.UserService.DeviceDB.GetByUserID(user.ID)
	if err != nil {
		return err
	}

	webAuthnUser := WebAuthnUser{
		User:    user,
		devices: devices,
	}

	credentialCreation, sessionData, err := h.WebAuthn.BeginRegistration(webAuthnUser)
	if err != nil {
		return err
	}

	// Store session data in session store with 5 minute TTL
	sessionKey := e.Request().Header.Get("X-Session-Key")
	if sessionKey == "" {
		sessionKey = fmt.Sprintf("reg_%s_%d", username, time.Now().UnixNano())
	}
	h.SessionStore.Set(sessionKey, sessionData, 5*time.Minute)

	// Store session key in response headers for the client to use
	e.Response().Header().Set("X-Session-Key", sessionKey)

	return e.JSON(200, credentialCreation)
}

// FinishRegistration completes the passkey registration process
func (h *Fido2Handler) FinishRegistration(e echo.Context) error {
	username := apihelper.GetUserId(e)
	if username == "" {
		return errors.Unauthorized("unauthorized")
	}

	user, err := h.UserService.DB.GetUserByUserName(username)
	if err != nil {
		return err
	}

	// Parse the full request body first
	var fullRequest map[string]interface{}
	if err := e.Bind(&fullRequest); err != nil {
		fmt.Printf("Error binding full request: %v\n", err)
		return errors.BadRequest("invalid request: " + err.Error())
	}

	// Extract our custom fields
	deviceName, ok := fullRequest["name"].(string)
	if !ok {
		return errors.NewValidationError("device name is required", "name")
	}

	sessionKey := e.Request().Header.Get("X-Session-Key")
	if sessionKey == "" {
		return errors.NewValidationError("session key is required", "sessionKey")
	}

	// Remove our custom fields to get the raw WebAuthn credential
	delete(fullRequest, "name")
	delete(fullRequest, "sessionKey")

	devices, err := h.UserService.DeviceDB.GetByUserID(user.ID)
	if err != nil {
		return err
	}

	webAuthnUser := WebAuthnUser{
		User:    user,
		devices: devices,
	}

	sessionData := h.SessionStore.Get(sessionKey)
	if sessionData == nil {
		return fmt.Errorf("no registration session found or session expired %s", sessionKey)
	}

	// Create a new request with only the WebAuthn credential data
	credentialJSON, err := json.Marshal(fullRequest)
	if err != nil {
		return errors.Unauthorized("invalid credential data")
	}

	// Create a new HTTP request with the clean credential data
	credentialRequest := e.Request().Clone(e.Request().Context())
	credentialRequest.Body = io.NopCloser(bytes.NewReader(credentialJSON))
	credentialRequest.ContentLength = int64(len(credentialJSON))

	credential, err := h.WebAuthn.FinishRegistration(webAuthnUser, *sessionData, credentialRequest)
	if err != nil {
		return errors.Unauthorized("failed to finish registration: " + err.Error())
	}

	// Clean up session
	h.SessionStore.Delete(sessionKey)

	// Store the credential in the database
	now := time.Now()
	device := &users.UserDevice{
		UserID:         user.ID,
		Name:           deviceName,
		CredentialID:   base64.StdEncoding.EncodeToString(credential.ID),
		PublicKey:      base64.StdEncoding.EncodeToString(credential.PublicKey),
		SignCount:      credential.Authenticator.SignCount,
		AAGUID:         string(credential.Authenticator.AAGUID),
		BackupEligible: credential.Flags.BackupEligible,
		BackupState:    credential.Flags.BackupState,
		CreatedAt:      now,
		IsActive:       true,
	}

	if err := h.UserService.DeviceDB.CreateDevice(device); err != nil {
		return err
	}

	return apihelper.OkMessage(e, "passkey registered successfully")
}

// BeginLogin starts the passkey authentication process
func (h *Fido2Handler) BeginLogin(e echo.Context) error {
	assertion, sessionData, err := h.WebAuthn.BeginDiscoverableLogin()
	if err != nil {
		return err
	}

	if h.RateLimiter != nil && !h.RateLimiter.AllowRequest(e.RealIP()) {
		return e.JSON(429, map[string]string{"error": "too many login attempts. Please wait a moment."})
	}

	// Store session data in session store with 5 minute TTL
	sessionKey := e.Request().Header.Get("X-Session-Key")
	if sessionKey == "" {
		sessionKey = fmt.Sprintf("login_%d", time.Now().UnixNano())
	}
	h.SessionStore.Set(sessionKey, sessionData, 5*time.Minute)

	// Store session key in response headers for the client to use
	e.Response().Header().Set("X-Session-Key", sessionKey)

	return e.JSON(200, assertion)
}

// FinishLogin completes the passkey authentication process
func (h *Fido2Handler) FinishLogin(e echo.Context) error {
	// Parse the full request body first
	var fullRequest map[string]interface{}
	if err := e.Bind(&fullRequest); err != nil {
		return errors.BadRequest("invalid request: " + err.Error())
	}

	// Extract session key from request
	sessionKey := e.Request().Header.Get("X-Session-Key")
	if sessionKey == "" {
		return errors.NewValidationError("session key is required", "sessionKey")
	}

	delete(fullRequest, "sessionKey")

	sessionData := h.SessionStore.Get(sessionKey)
	if sessionData == nil {
		return errors.NewValidationError("no login session found or session expired", "sessionKey")
	}

	// Define the discoverable user handler
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		// Find the user device by credential ID
		credentialID := base64.StdEncoding.EncodeToString(rawID)
		device, err := h.UserService.DeviceDB.GetByCredentialID(credentialID)
		if err != nil || device == nil {
			return nil, errors.Unauthorized("credential not found")
		}

		if !device.IsActive {
			return nil, errors.Unauthorized("device is inactive")
		}

		// Get the user
		user, err := h.UserService.DB.GetUserByID(device.UserID)
		if err != nil || user == nil {
			return nil, errors.Unauthorized("user not found")
		}

		if user.IsLockedOut {
			fmt.Printf("User is locked out: %s\n", user.UserName)
			return nil, errors.Unauthorized("account is locked")
		}

		devices, err := h.UserService.DeviceDB.GetByUserID(user.ID)
		if err != nil {
			fmt.Printf("Failed to get user devices: %v\n", err)
			return nil, errors.Unauthorized("failed to get user devices")
		}
		fmt.Printf("Returning user with %d devices\n", len(devices))
		return WebAuthnUser{
			User:    user,
			devices: devices,
		}, nil
	}

	// Create a new request with only the WebAuthn credential data
	credentialJSON, err := json.Marshal(fullRequest)
	if err != nil {
		log.Printf("error marshalling login credential data: %v\n", err)
		return errors.BadRequest("invalid credential data")
	}

	// Create a new HTTP request with the clean credential data
	credentialRequest := e.Request().Clone(e.Request().Context())
	credentialRequest.Body = io.NopCloser(bytes.NewReader(credentialJSON))
	credentialRequest.ContentLength = int64(len(credentialJSON))

	// Finish the login process
	user, credential, err := h.WebAuthn.FinishPasskeyLogin(handler, *sessionData, credentialRequest)
	if err != nil {
		return errors.Unauthorized("authentication failed: " + err.Error())
	}

	// Clean up session
	h.SessionStore.Delete(sessionKey)

	// Get the actual user from our handler result
	webAuthnUser, ok := user.(WebAuthnUser)
	if !ok {
		return fmt.Errorf("failed to cast user to WebAuthnUser %s", user.WebAuthnName())
	}

	// Find the device to update
	credentialID := base64.StdEncoding.EncodeToString(credential.ID)
	device, err := h.UserService.DeviceDB.GetByCredentialID(credentialID)
	if err == nil && device != nil {
		// Update device sign count, backup state, and last used time
		device.SignCount = credential.Authenticator.SignCount
		device.BackupEligible = credential.Flags.BackupEligible
		device.BackupState = credential.Flags.BackupState
		now := time.Now()
		device.LastUsedAt = &now
		if err := h.UserService.DeviceDB.UpdateDevice(device); err != nil {
			// Log error but don't fail the login
			log.Printf("Failed to update device: %v\n", err)
		}
	}

	tokenExpiry := time.Now().Add(time.Hour * 24)
	signedToken, err := h.KeyStore.SignJWT(jwt.MapClaims{
		"uid":   webAuthnUser.UserName,
		"scope": webAuthnUser.Role,
		"iat":   time.Now().Unix(),
		"exp":   tokenExpiry.Unix(),
	}, "auth")

	if err != nil {
		return err
	}

	e.SetCookie(&http.Cookie{
		Name:     "user",
		Value:    webAuthnUser.UserName,
		Expires:  tokenExpiry,
		SameSite: http.SameSiteDefaultMode,
		Path:     "/",
	})
	e.SetCookie(&http.Cookie{
		Name:     "token",
		Value:    signedToken,
		Expires:  tokenExpiry,
		SameSite: http.SameSiteDefaultMode,
		HttpOnly: true,
		Path:     "/",
	})

	// Return similar to regular login
	type LoginResponse struct {
		Token string `json:"token"`
	}
	return e.JSON(200, &LoginResponse{Token: signedToken})
}

// GetUserDevices returns all devices for the authenticated user
func (h *Fido2Handler) GetUserDevices(e echo.Context) error {
	username := apihelper.GetUserId(e)
	if username == "" {
		return errors.Unauthorized("unauthorized")
	}

	user, err := h.UserService.DB.GetUserByUserName(username)
	if err != nil {
		return err
	}

	devices, err := h.UserService.DeviceDB.GetByUserID(user.ID)
	if err != nil {
		return err
	}

	// Return devices without sensitive data
	type DeviceResponse struct {
		ID         int        `json:"id"`
		Name       string     `json:"name"`
		CreatedAt  time.Time  `json:"createdAt"`
		LastUsedAt *time.Time `json:"lastUsedAt"`
		IsActive   bool       `json:"isActive"`
	}

	responses := make([]DeviceResponse, len(devices))
	for i, device := range devices {
		responses[i] = DeviceResponse{
			ID:         device.ID,
			Name:       device.Name,
			CreatedAt:  device.CreatedAt,
			LastUsedAt: device.LastUsedAt,
			IsActive:   device.IsActive,
		}
	}

	return e.JSON(200, responses)
}

// DeleteDevice removes a passkey device
func (h *Fido2Handler) DeleteDevice(e echo.Context) error {
	username := apihelper.GetUserId(e)
	if username == "" {
		return errors.Unauthorized("unauthorized")
	}

	deviceIDStr := e.Param("id")
	deviceID, err := strconv.Atoi(deviceIDStr)
	if err != nil {
		return errors.BadRequest("invalid device ID")
	}

	user, err := h.UserService.DB.GetUserByUserName(username)
	if err != nil {
		return err
	}

	device, err := h.UserService.DeviceDB.GetByID(deviceID)
	if err != nil || device == nil {
		return errors.NotFound("device not found")
	}

	// Ensure the device belongs to the authenticated user
	if device.UserID != user.ID {
		return errors.Forbidden("forbidden")
	}

	if err := h.UserService.DeviceDB.DeleteDevice(deviceID); err != nil {
		return err
	}

	return e.JSON(200, map[string]string{"message": "device deleted successfully"})
}
