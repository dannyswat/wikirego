package pages

import (
	"regexp"
	"time"

	"wikirego/internal/common/errors"
	"wikirego/internal/revisions"

	"github.com/go-playground/validator/v10"
)

type PageService struct {
	DB              PageRepository
	RevisionService *revisions.RevisionService[*Page]
	SearchService   *SearchService
}

func (s *PageService) GetPageByID(id int) (*Page, error) {
	return s.DB.GetPageByID(id)
}

func (s *PageService) GetPageByUrl(url string) (*Page, error) {
	return s.DB.GetPageByUrl(url)
}

func (s *PageService) GetPagesByAuthor(author string) ([]*PageMeta, error) {
	return s.DB.GetPagesByAuthor(author)
}

func (s *PageService) GetPagesByParentID(parentID *int) ([]*PageMeta, error) {
	return s.DB.GetPagesByParentID(parentID)
}

func (s *PageService) GetAllPages(includeProtected bool) ([]*PageMeta, error) {
	return s.DB.GetAllPages(includeProtected)
}

func (s *PageService) CreatePage(page *Page, user string) error {
	if err := ValidatePage(page, true); err != nil {
		return err
	}
	if page.ParentID != nil {
		parent, err := s.DB.GetPageByID(*page.ParentID)
		if err != nil {
			return err
		}
		if parent == nil {
			return errors.NewValidationError("parent page not found", "ParentID")
		}
	}
	page.CreatedAt = time.Now()
	page.CreatedBy = user
	page.LastModifiedAt = page.CreatedAt
	page.LastModifiedBy = user
	err := s.DB.CreatePage(page)
	if err == nil {
		err = s.SearchService.AddPageSearchTerms(page)
	}
	return err
}

func (s *PageService) UpdatePage(page *Page, user string) error {
	oldPage, err := s.DB.GetPageByID(page.ID)
	if err != nil {
		return err
	}
	if err := ValidatePage(page, false); err != nil {
		return err
	}
	if cyclical, err := s.DB.IsPageCyclical(page); err != nil {
		return err
	} else if cyclical {
		return errors.NewValidationError("cyclical page detected", "ParentID")
	}
	page.LastModifiedAt = time.Now()
	page.LastModifiedBy = user
	err = s.DB.UpdatePage(page)
	if err != nil {
		return err
	}
	err = s.RevisionService.AddRevision(page.ID, oldPage)
	if err == nil {
		err = s.SearchService.UpdatePageSearchTerms(page, oldPage)
	}
	return err
}

func (s *PageService) DeletePage(id int) error {
	if id <= 0 {
		return errors.NewValidationError("invalid page ID", "ID")
	}
	page, err := s.DB.GetPageByID(id)
	if err != nil {
		return errors.NewValidationError("page not found", "ID")
	}
	err = s.DB.DeletePage(id)
	if err != nil {
		return err
	}
	err = s.SearchService.DeletePageSearchTerms(page)
	return err
}

func ValidatePage(page *Page, isNew bool) error {
	if page == nil {
		return errors.NewValidationError("page is nil", "")
	}
	if !isNew && page.ID == 0 {
		return errors.NewValidationError("page not found", "")
	}
	v := validator.New()
	if err := v.Struct(page); err != nil {
		validateError := err.(validator.ValidationErrors)

		aggError := &errors.AggregateValidationError{}
		for _, e := range validateError {
			aggError.AddError(errors.NewValidationError(e.Error(), e.Field()))
		}
		return aggError
	}
	if matched, err := regexp.Match(`^(([/])|(([/][a-zA-Z0-9-]+)+))$`, []byte(page.Url)); !matched || err != nil {
		return errors.NewValidationError("invalid url", "Url")
	}
	return nil
}
