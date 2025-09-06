package handlers

import (
	"encoding/base64"
	"net/http"
	"time"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/keymgmt"
	"wikirego/internal/users"

	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	UserService *users.UserService
	KeyStore    *keymgmt.KeyMgmtService
	RateLimiter *apihelper.RateLimiter
}

type PublicKeyResponse struct {
	Key       string `json:"key"`
	Timestamp string `json:"timestamp"`
}

func (h *AuthHandler) GetPublicKey(e echo.Context) error {
	purpose := e.Param("id")
	if purpose == "" {
		return errors.BadRequest("invalid request")
	}
	if purpose != "login" && purpose != "changepassword" {
		return errors.BadRequest("invalid request")
	}
	key, err := h.KeyStore.GetPublicKeyForEncryption(purpose)
	if err != nil {
		return err
	}
	return e.JSON(200, &PublicKeyResponse{
		Key:       base64.StdEncoding.EncodeToString(key),
		Timestamp: time.Now().Format("20060102150405"),
	})
}

type LoginRequest struct {
	UserName string `json:"userName" validate:"required,max=50"`
	Password string `json:"password" validate:"required"`
	Key      string `json:"key" validate:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
}

func (h *AuthHandler) Login(e echo.Context) error {
	req := new(LoginRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	if err := validator.New().Struct(req); err != nil {
		return errors.BadRequest("invalid request")
	}

	if h.RateLimiter != nil && !h.RateLimiter.AllowRequest(req.UserName) {
		return e.JSON(429, apihelper.NewRateLimitError("Too many login attempts. Please wait a moment."))
	}

	pwdBytes, err := base64.StdEncoding.DecodeString(req.Password)
	if err != nil {
		return errors.Unauthorized("invalid username or password")
	}
	keyBytes, err := base64.StdEncoding.DecodeString(req.Key)
	if err != nil {
		return errors.Unauthorized("invalid username or password")
	}
	passwordWithTime, err := h.KeyStore.Decrypt("login", pwdBytes, keyBytes)
	if err != nil {
		return errors.Unauthorized("invalid username or password")
	}
	timestamp, password := string(passwordWithTime[:14]), string(passwordWithTime[14:])
	pwdTime, err := time.Parse("20060102150405", timestamp)
	if err != nil || pwdTime.Add(time.Minute*5).Before(time.Now()) {
		return errors.Unauthorized("invalid username or password")
	}

	user, err := h.UserService.Login(req.UserName, password)
	if err != nil {
		return errors.Unauthorized("invalid username or password")
	}
	tokenExpiry := time.Now().Add(time.Hour * 24)
	signedToken, err := h.KeyStore.SignJWT(jwt.MapClaims{
		"uid":   user.UserName,
		"scope": user.Role,
		"iat":   time.Now().Unix(),
		"exp":   tokenExpiry.Unix(),
	}, "auth")

	if err != nil {
		return err
	}
	e.SetCookie(&http.Cookie{
		Name:     "user",
		Value:    user.UserName,
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
	return e.JSON(200, &LoginResponse{Token: signedToken})
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"oldPassword" validate:"required"`
	NewPassword     string `json:"newPassword" validate:"required"`
	Key             string `json:"key" validate:"required"`
	NewKey          string `json:"newKey" validate:"required"`
}

func (h *AuthHandler) ChangePassword(e echo.Context) error {
	req := new(ChangePasswordRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	if err := validator.New().Struct(req); err != nil {
		return errors.NewValidationError("invalid request", "")
	}
	pwdBytes, err := base64.StdEncoding.DecodeString(req.CurrentPassword)
	if err != nil {
		return &users.UnauthorizedError{Message: "invalid password"}
	}
	keyBytes, err := base64.StdEncoding.DecodeString(req.Key)
	if err != nil {
		return &users.UnauthorizedError{Message: "invalid password"}
	}
	passwordWithTime, err := h.KeyStore.Decrypt("login", pwdBytes, keyBytes)
	if err != nil {
		return &users.UnauthorizedError{Message: "invalid password"}
	}
	password := passwordWithTime[14:]
	newPwdBytes, err := base64.StdEncoding.DecodeString(req.NewPassword)
	if err != nil {
		return &users.UnauthorizedError{Message: "invalid new password"}
	}
	keyBytes, err = base64.StdEncoding.DecodeString(req.NewKey)
	if err != nil {
		return &users.UnauthorizedError{Message: "invalid new password"}
	}
	newPasswordWithTime, err := h.KeyStore.Decrypt("changepassword", newPwdBytes, keyBytes)
	if err != nil {
		return errors.NewValidationError("invalid new password", "newPassword")
	}
	newPassword := newPasswordWithTime[14:]

	token := e.Get("token").(*jwt.Token)
	claims := token.Claims.(jwt.MapClaims)
	username := str(claims["uid"])
	err = h.UserService.ChangePassword(username, string(password), string(newPassword))
	if err != nil {
		return errors.Unauthorized("invalid password")
	}
	return apihelper.OkMessage(e, "password updated")
}

type RoleResponse struct {
	Role string `json:"role"`
}

func (h *AuthHandler) GetRole(e echo.Context) error {
	role := str(e.Get("role"))
	return e.JSON(200, &RoleResponse{Role: role})
}

func (h *AuthHandler) Logout(e echo.Context) error {
	apihelper.RemoveAuthCookie(e)
	return apihelper.OkMessage(e, "logged out successfully")
}

func str(o any) string {
	s, ok := o.(string)
	if !ok {
		return ""
	}
	return s
}
