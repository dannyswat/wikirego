package main

import (
	"fmt"
	"html/template"
	"os"
	"strings"

	wiki "wikirego/internal/app"
	"wikirego/internal/app/handlers"
	"wikirego/internal/app/middlewares"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	currentDir, err := os.Getwd()
	if err != nil {
		panic(fmt.Sprintf("Failed to get current working directory: %v", err))
	}
	fmt.Printf("Current working directory: %s\n", currentDir)

	app := &wiki.WikiStartUp{
		DataPath:   "data",
		BaseRoute:  "/api",
		MediaPath:  "media",
		ConfigPath: "conf",
	}
	isSetupComplete := true
	if err := app.Setup(); err == wiki.ErrSetupIncomplete {
		isSetupComplete = false
	} else if err != nil {
		panic(err)
	}

	e := echo.New()
	e.Renderer = &handlers.Template{
		Templates: template.Must(template.ParseGlob("views/*.html")),
	}
	e.Use(middleware.Logger())
	e.Use(middleware.Gzip())
	e.Use(middleware.Recover())
	if isSetupComplete {
		ss, ok := app.SecuritySettingCache.Get()
		if !ok {
			panic("Failed to get security settings")
		}
		if ss.AllowCors {
			e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
				AllowOrigins:     ss.AllowedCorsOrigins,
				AllowMethods:     strings.Split(ss.AllowedCorsMethods, ","),
				AllowHeaders:     []string{"*"},
				AllowCredentials: true,
			}))
		}
		e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
			XSSProtection:         ss.XSSProtection,
			ContentTypeNosniff:    ss.XContentTypeOptions,
			XFrameOptions:         ss.FrameOptions,
			ReferrerPolicy:        ss.ReferrerPolicy,
			ContentSecurityPolicy: ss.ContentSecurityPolicy,
			HSTSMaxAge:            3600,
		}))
	}
	e.Static("/media", app.MediaPath)
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Root:       "public",
		Skipper:    nil,
		Index:      "index.html",
		Browse:     false,
		HTML5:      true,
		IgnoreBase: false,
		Filesystem: nil,
	}))
	e.Use(middlewares.ErrorMiddleware())

	app.RegisterSetupHandlers(e, isSetupComplete)

	if isSetupComplete {
		app.RegisterHandlers(e)
	}
	e.GET("*", func(c echo.Context) error {
		c.Response().Header().Set(echo.HeaderCacheControl, "no-cache, no-store, must-revalidate")
		return c.File("public/index.html")
	})
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("SERVER_PORT")
	}
	if port == "" {
		port = os.Getenv("HTTP_PLATFORM_PORT")
	}
	if port == "" {
		port = "8080"
	}

	e.Logger.Printf("Server started at port %s", port)
	e.Logger.Fatal(e.Start(":" + port))
}
