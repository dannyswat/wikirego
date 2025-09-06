package handlers

import (
	"strconv"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/users"

	"github.com/labstack/echo/v4"
)

type UsersHandler struct {
	UserService *users.UserService
}

type UserResponse struct {
	ID          int    `json:"id"`
	UserName    string `json:"username"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	IsLockedOut bool   `json:"isLockedOut"`
}

func ToUserResponse(user *users.User) *UserResponse {
	return &UserResponse{
		ID:          user.ID,
		UserName:    user.UserName,
		Email:       user.Email,
		Role:        user.Role,
		IsLockedOut: user.IsLockedOut,
	}
}

func (h *UsersHandler) GetUsers(e echo.Context) error {
	users, err := h.UserService.ListAll()
	if err != nil {
		return err
	}
	usersResp := make([]*UserResponse, len(users))
	for i, user := range users {
		usersResp[i] = ToUserResponse(user)
	}
	return e.JSON(200, users)
}

func (h *UsersHandler) GetUser(e echo.Context) error {
	sId := e.Param("id")
	if sId == "" {
		return errors.BadRequest("invalid request")
	}
	userId, err := strconv.Atoi(sId)
	if err != nil {
		return errors.BadRequest("invalid request")
	}
	user, err := h.UserService.DB.GetUserByID(userId)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.NotFound("user not found")
	}
	return e.JSON(200, ToUserResponse(user))
}

func (h *UsersHandler) GetCurrentUser(e echo.Context) error {
	userId := apihelper.GetUserId(e)
	if userId == "" {
		return errors.BadRequest("invalid request")
	}
	user, err := h.UserService.DB.GetUserByUserName(userId)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.NotFound("user not found")
	}
	return e.JSON(200, ToUserResponse(user))
}

type CreateUserRequest struct {
	UserName string `json:"username" validate:"required,max=50"`
	Password string `json:"password" validate:"required"`
	Email    string `json:"email" validate:"required,email,max=100"`
	Role     string `json:"role" validate:"required,oneof=reader editor admin"`
}

func (h *UsersHandler) CreateUser(e echo.Context) error {
	userReq := new(CreateUserRequest)
	if err := e.Bind(userReq); err != nil {
		return errors.BadRequest(err.Error())
	}
	user := &users.User{
		UserName: userReq.UserName,
		Email:    userReq.Email,
		Role:     userReq.Role,
	}
	if err := user.UpdatePassword(user.Password); err != nil {
		return err
	}
	if err := h.UserService.CreateUser(user); err != nil {
		return err
	}
	return e.JSON(201, user)
}

type UpdateUserRequest struct {
	UserName    string `json:"username" validate:"required,max=50"`
	Email       string `json:"email" validate:"required,email,max=100"`
	Role        string `json:"role" validate:"required,oneof=reader editor admin"`
	NewPassword string `json:"newPassword"`
}

func (h *UsersHandler) UpdateUser(e echo.Context) error {
	sId := e.Param("id")
	if sId == "" {
		return errors.BadRequest("invalid request")
	}
	userId, err := strconv.Atoi(sId)
	if err != nil {
		return errors.BadRequest("invalid request")
	}
	userReq := new(UpdateUserRequest)
	if err := e.Bind(userReq); err != nil {
		return errors.BadRequest(err.Error())
	}
	user, err := h.UserService.DB.GetUserByID(userId)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.NotFound("user not found")
	}
	user.UserName = userReq.UserName
	user.Email = userReq.Email
	user.Role = userReq.Role
	if userReq.NewPassword != "" {
		if err := user.UpdatePassword(userReq.NewPassword); err != nil {
			return err
		}
	}
	if err := h.UserService.UpdateUser(user); err != nil {
		return err
	}
	return e.JSON(200, user)
}
