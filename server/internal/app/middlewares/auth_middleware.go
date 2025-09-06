package middlewares

import (
	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/keymgmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type JWT struct {
	KeyStore *keymgmt.KeyMgmtService
}

func (j *JWT) AuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(e echo.Context) error {
			user, err := e.Cookie("user")
			if err != nil {
				return next(e)
			}
			accessToken, err := e.Cookie("token")
			if err != nil {
				apihelper.RemoveAuthCookie(e)
				return next(e)
			}
			token, err := j.KeyStore.VerifyJWT(accessToken.Value, "auth")
			if err != nil || !token.Valid {
				apihelper.RemoveAuthCookie(e)
				return next(e)
			}
			userId, role := apihelper.GetUserIdAndRoleFromToken(token)
			if user.Value != userId {
				apihelper.RemoveAuthCookie(e)
				return next(e)
			}
			e.Set("user", user.Value)
			e.Set("role", role)
			e.Set("token", token)
			return next(e)
		}
	}
}

func (j *JWT) ParseToken(tokenString string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return j.KeyStore.GetPublicKey("auth")
	})
}

func AuthorizeMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(e echo.Context) error {
			token, ok := e.Get("token").(*jwt.Token)
			if !ok || !token.Valid {
				return &errors.ForbiddenError{Message: "unauthorized to access the resource"}
			}
			return next(e)
		}
	}
}

func AdminMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(e echo.Context) error {
			role := str(e.Get("role"))
			if role != "admin" {
				return &errors.ForbiddenError{Message: "unauthorized to access the resource"}
			}
			return next(e)
		}
	}
}

func EditorMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(e echo.Context) error {
			role := str(e.Get("role"))
			if role != "editor" && role != "admin" {
				return &errors.ForbiddenError{Message: "unauthorized to access the resource"}
			}
			return next(e)
		}
	}
}

func str(o interface{}) string {
	s, ok := o.(string)
	if !ok {
		return ""
	}
	return s
}
