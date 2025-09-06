package handlers

import (
	"log"
	"strconv"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/pages"
	"wikirego/internal/revisions"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/microcosm-cc/bluemonday"
)

type PageHandler struct {
	PageService         *pages.PageService
	SearchService       *pages.SearchService
	PageRevisionService *revisions.RevisionService[*pages.Page]
	HtmlPolicy          *bluemonday.Policy
	ReactPage           *pages.ReactPageMeta
}

func (h *PageHandler) GetPageByID(e echo.Context) error {
	idStr := e.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return errors.BadRequest("invalid page id")
	}
	page, err := h.PageService.GetPageByID(id)
	if err != nil {
		return errors.NotFound("page not found")
	}
	return e.JSON(200, pages.NewReactPage(page, h.ReactPage))
}

func (h *PageHandler) GetPageByUrl(e echo.Context) error {
	url := e.Param("url")
	page, err := h.PageService.GetPageByUrl("/" + url)
	if err != nil {
		return errors.NotFound("page not found")
	}
	if page.IsProtected && apihelper.GetUserId(e) == "" {
		return errors.Forbidden("page is protected")
	}
	return e.JSON(200, page)
}

func (h *PageHandler) GetPagesByAuthor(e echo.Context) error {
	author := e.QueryParam("author")
	pages, err := h.PageService.GetPagesByAuthor(author)
	if err != nil {
		return errors.NotFound("pages not found")
	}
	return e.JSON(200, pages)
}

func (h *PageHandler) GetPagesByParentID(e echo.Context) error {
	idStr := e.Param("id")
	var id *int
	if idStr != "" {
		idInt, err := strconv.Atoi(idStr)
		if err != nil {
			return errors.BadRequest("invalid page id")
		}
		id = &idInt
	}

	pages, err := h.PageService.GetPagesByParentID(id)
	if err != nil {
		return errors.NotFound("pages not found")
	}
	return e.JSON(200, pages)
}

func (h *PageHandler) GetAllPages(e echo.Context) error {
	includeProtected := apihelper.GetUserId(e) != ""
	pages, err := h.PageService.GetAllPages(includeProtected)
	if err != nil {
		return err
	}
	return e.JSON(200, pages)
}

func (h *PageHandler) SearchPages(e echo.Context) error {
	query := e.QueryParam("q")
	if query == "" {
		return errors.NewValidationError("query parameter 'q' is required", "q")
	}
	pages, err := h.SearchService.Search(query, 10)
	if err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}
	return e.JSON(200, pages)
}

func (h *PageHandler) Page(e echo.Context) error {
	if h.ReactPage == nil {
		return e.Redirect(302, "/")
	}
	idStr := e.Param("id")
	page, err := h.PageService.GetPageByUrl("/" + idStr)
	if err != nil || page == nil {
		log.Println("Page not found:", err)
		return e.Render(404, "404", nil)
	}
	if page.IsProtected && apihelper.GetUserId(e) == "" {
		return e.Redirect(302, "/login")
	}
	return e.Render(200, "page", pages.NewReactPage(page, h.ReactPage))
}

func (h *PageHandler) GetLatestRevision(e echo.Context) error {
	idStr := e.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return errors.NewValidationError("invalid page id", "id")
	}
	revision, err := h.PageRevisionService.GetLatestRevision(id)
	if err != nil {
		return errors.NotFound("revision not found")
	}
	return e.JSON(200, revision)
}

type CreatePageRequest struct {
	Url              string   `json:"url" validate:"required,max=100"`
	Title            string   `json:"title" validate:"required,max=100"`
	Content          string   `json:"content" validate:"required"`
	ShortDesc        string   `json:"shortDesc" validate:"max=300"`
	ParentID         *int     `json:"parentId"`
	Tags             []string `json:"tags" validate:"max=10"`
	IsPinned         bool     `json:"isPinned"`
	IsProtected      bool     `json:"isProtected"`
	IsCategoryPage   bool     `json:"isCategoryPage"`
	SortChildrenDesc bool     `json:"sortChildrenDesc"`
}

func (h *PageHandler) CreatePage(e echo.Context) error {

	req := new(CreatePageRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	if err := validator.New().Struct(req); err != nil {
		return errors.BadRequest("invalid request: " + err.Error())
	}
	page := new(pages.Page)
	page.Url = req.Url
	page.Title = req.Title
	page.Content = h.HtmlPolicy.Sanitize(req.Content)
	page.ShortDesc = req.ShortDesc
	page.ParentID = req.ParentID
	page.Tags = req.Tags
	page.IsPinned = req.IsPinned
	page.IsProtected = req.IsProtected
	page.IsCategoryPage = req.IsCategoryPage
	page.SortChildrenDesc = req.SortChildrenDesc
	if err := h.PageService.CreatePage(page, apihelper.GetUserId(e)); err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}
	return e.JSON(200, req)
}

type UpdatePageRequest struct {
	ID               int      `json:"id" validate:"required"`
	Url              string   `json:"url" validate:"required,max=100"`
	Title            string   `json:"title" validate:"required,max=100"`
	Content          string   `json:"content" validate:"required"`
	ShortDesc        string   `json:"shortDesc" validate:"max=300"`
	ParentID         *int     `json:"parentId"`
	Tags             []string `json:"tags" validate:"max=10"`
	IsPinned         bool     `json:"isPinned"`
	IsProtected      bool     `json:"isProtected"`
	IsCategoryPage   bool     `json:"isCategoryPage"`
	SortChildrenDesc bool     `json:"sortChildrenDesc"`
}

func (h *PageHandler) UpdatePage(e echo.Context) error {
	req := new(UpdatePageRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	if err := validator.New().Struct(req); err != nil {
		return errors.BadRequest("invalid request: " + err.Error())
	}
	page := new(pages.Page)
	page.ID = req.ID
	page.Url = req.Url
	page.Title = req.Title
	page.Content = h.HtmlPolicy.Sanitize(req.Content)
	page.ShortDesc = req.ShortDesc
	page.ParentID = req.ParentID
	page.Tags = req.Tags
	page.IsPinned = req.IsPinned
	page.IsProtected = req.IsProtected
	page.IsCategoryPage = req.IsCategoryPage
	page.SortChildrenDesc = req.SortChildrenDesc
	if err := h.PageService.UpdatePage(page, apihelper.GetUserId(e)); err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}
	return e.JSON(200, req)
}

func (h *PageHandler) DeletePage(e echo.Context) error {
	idStr := e.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return errors.NewValidationError("invalid page id", "id")
	}
	if err := h.PageService.DeletePage(id); err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}
	return apihelper.OkMessage(e, "page deleted")
}

func (h *PageHandler) RebuildSearchIndex(e echo.Context) error {
	if err := h.SearchService.RebuildSearchIndex(); err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}
	return apihelper.OkMessage(e, "search index rebuilt")
}
