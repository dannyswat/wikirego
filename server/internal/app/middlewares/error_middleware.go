package middlewares

import (
	"wikirego/internal/common/apihelper"

	"github.com/labstack/echo/v4"
)

func ErrorMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(e echo.Context) error {
			err := next(e)
			if err != nil {
				return apihelper.ReturnErrorResponse(e, err)
			}
			return nil
		}
	}
}
