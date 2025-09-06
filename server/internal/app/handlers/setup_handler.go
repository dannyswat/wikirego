package handlers

import (
	"time"
	"wikirego/internal/common"
	"wikirego/internal/setting"
	"wikirego/internal/users"

	"github.com/labstack/echo/v4"
)

type SetupHandler struct {
	settingService *setting.SettingService
	userService    *users.UserService // Assuming you have a UserService for user management
}

func NewSetupHandler(settingService *setting.SettingService, userService *users.UserService) *SetupHandler {
	return &SetupHandler{
		settingService: settingService,
		userService:    userService,
	}
}

type SettingResponse struct {
	IsSetupComplete bool             `json:"is_setup_complete"`
	IsAdminCreated  bool             `json:"is_admin_created"`
	Setting         *setting.Setting `json:"setting"`
}

func (h *SetupHandler) GetSetting(c echo.Context) error {
	setting, err := h.settingService.GetSetting()
	if err != nil {
		return c.JSON(500, map[string]string{"error": "Failed to get setting"})
	}
	adminUser, err := h.userService.DB.GetUserByUserName("admin")
	if err != nil {
		return c.JSON(500, map[string]string{"error": "Failed to get admin user"})
	}
	return c.JSON(200, SettingResponse{
		IsSetupComplete: setting != nil,
		IsAdminCreated:  adminUser != nil,
		Setting:         setting,
	})
}

type CreateAdminRequest struct {
	UserName string `json:"user_name" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6,max=100"`
}

func (h *SetupHandler) CreateAdmin(c echo.Context) error {
	var req CreateAdminRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "Invalid request"})
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}
	adminUser := &users.User{
		UserName:    req.UserName,
		Email:       req.Email,
		Role:        "admin",
		IsLockedOut: false,
		CreatedAt:   time.Now(),
	}
	adminUser.UpdatePassword(req.Password)
	if err := h.userService.CreateUser(adminUser); err != nil {
		return c.JSON(500, map[string]string{"error": "Failed to create admin user"})
	}
	return c.JSON(201, map[string]string{"message": "Admin user created successfully"})
}

func (h *SetupHandler) CreateSetting(c echo.Context) error {
	var newSetting setting.Setting
	if err := c.Bind(&newSetting); err != nil {
		return c.JSON(400, map[string]string{"error": "Invalid request"})
	}
	if err := h.settingService.Init(&newSetting, &setting.SecuritySetting{}); err != nil {
		return c.JSON(500, map[string]string{"error": "Failed to create setting"})
	}

	go common.ExitApplication()
	return c.JSON(201, map[string]string{"message": "Setting created successfully"})
}
