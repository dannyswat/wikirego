package apihelper

import (
	"log"

	"wikirego/internal/common/errors"
	"wikirego/internal/users"

	"github.com/labstack/echo/v4"
)

type ErrorResponse struct {
	Message string    `json:"message"`
	Code    ErrorCode `json:"code"`
}

type ErrorResponseWithDetails[T interface{}] struct {
	Message string    `json:"message"`
	Code    ErrorCode `json:"code"`
	Details T         `json:"details"`
}

type ErrorCode string

const (
	ErrCodeInvalidRequest ErrorCode = "INVALID_REQUEST"
	ErrCodeInternalError  ErrorCode = "INTERNAL_ERROR"
	ErrCodeNotFound       ErrorCode = "NOT_FOUND"
	ErrCodeUnauthorized   ErrorCode = "UNAUTHORIZED"
	ErrCodeRateLimit      ErrorCode = "RATE_LIMIT"
	ErrCodeForbidden      ErrorCode = "FORBIDDEN"
)

func GetErrorCode(status int) ErrorCode {
	switch status {
	case 400:
		return ErrCodeInvalidRequest
	case 401:
		return ErrCodeUnauthorized
	case 403:
		return ErrCodeForbidden
	case 404:
		return ErrCodeNotFound
	case 429:
		return ErrCodeRateLimit
	default:
		return ErrCodeInternalError
	}
}

func NewInvalidRequestError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeInvalidRequest}
}

func NewInvalidResponseErrorWithDetails[T interface{}](message string, details T) ErrorResponseWithDetails[T] {
	return ErrorResponseWithDetails[T]{Message: message, Code: ErrCodeInvalidRequest, Details: details}
}

func NewInternalError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeInternalError}
}

func NewNotFoundError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeNotFound}
}

func NewUnauthorizedError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeUnauthorized}
}

func NewForbiddenError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeForbidden}
}

func NewRateLimitError(message string) ErrorResponse {
	return ErrorResponse{Message: message, Code: ErrCodeRateLimit}
}

func GetErrorStatus(err error) int {
	switch err.(type) {
	case *users.UnauthorizedError:
		return 401
	case *errors.ValidationError:
		return 400
	case *errors.AggregateValidationError:
		return 400
	default:
		return 500
	}
}

func ReturnErrorResponse(e echo.Context, err error) error {
	switch err := err.(type) {
	case *echo.HTTPError:
		return e.JSON(err.Code, ErrorResponse{
			Message: err.Message.(string),
			Code:    GetErrorCode(err.Code),
		})
	case *users.UnauthorizedError:
		return e.JSON(401, NewUnauthorizedError(err.Error()))
	case *errors.UnauthorizedError:
		return e.JSON(401, NewUnauthorizedError(err.Error()))
	case *errors.ValidationError:
		return e.JSON(400, NewInvalidRequestError(err.Error()))
	case *errors.AggregateValidationError:
		return e.JSON(400, NewInvalidResponseErrorWithDetails(err.Error(), err.Errors))
	case *errors.ForbiddenError:
		return e.JSON(403, NewForbiddenError(err.Error()))
	case *errors.NotFoundError:
		return e.JSON(404, NewNotFoundError(err.Error()))
	default:
		log.Println(err)
		return e.JSON(500, NewInternalError("Internal server error"))
	}
}
