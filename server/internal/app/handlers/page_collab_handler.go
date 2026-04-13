package handlers

import (
	"strconv"

	"wikirego/internal/collab"
	"wikirego/internal/common/apihelper"
	apierrors "wikirego/internal/common/errors"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type PageCollabHandler struct {
	Hub      *collab.Hub
	Upgrader websocket.Upgrader
}

func NewPageCollabHandler(hub *collab.Hub) *PageCollabHandler {
	return &PageCollabHandler{
		Hub:      hub,
		Upgrader: collab.DefaultUpgrader(),
	}
}

func (h *PageCollabHandler) Collaborate(e echo.Context) error {
	id, err := strconv.Atoi(e.Param("id"))
	if err != nil {
		return apierrors.NewValidationError("invalid page id", "id")
	}
	userID := apihelper.GetUserId(e)
	if userID == "" {
		return apierrors.Forbidden("unauthorized to access the resource")
	}
	session, err := h.Hub.Session(id)
	if err != nil {
		return apierrors.NotFound("page not found")
	}
	conn, err := h.Upgrader.Upgrade(e.Response(), e.Request(), nil)
	if err != nil {
		return err
	}
	collab.NewConnection(userID, conn, session).Run()
	return nil
}
