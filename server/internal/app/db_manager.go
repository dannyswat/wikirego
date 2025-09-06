package wiki

import (
	"path/filepath"
	"wikirego/internal/app/repositories"
	"wikirego/internal/keymgmt"
	"wikirego/internal/pages"
	"wikirego/internal/revisions"
	"wikirego/internal/setting"
	"wikirego/internal/users"
)

type DBManager interface {
	Init() error
	Users() users.UserRepository
	UserDevices() users.UserDeviceRepository
	Pages() pages.PageRepository
	Keys() keymgmt.KeyRepository
	PageRevisions() revisions.RevisionRepository[*pages.Page]
	SearchTerms() pages.SearchTermListRepository
	Settings() setting.SettingRepository
}

type dbManager struct {
	users         users.UserRepository
	userDevices   users.UserDeviceRepository
	pages         pages.PageRepository
	keys          keymgmt.KeyRepository
	pageRevisions revisions.RevisionRepository[*pages.Page]
	searchTerms   pages.SearchTermListRepository
	settings      setting.SettingRepository
}

func NewDBManager(path string) DBManager {
	return &dbManager{
		users:         repositories.NewUserDB(path + "/users"),
		userDevices:   repositories.NewUserDeviceDB(path + "/user_devices"),
		pages:         repositories.NewPageDB(path + "/pages"),
		keys:          repositories.NewKeyDB(path + "/keys"),
		pageRevisions: repositories.NewRevisionRepository[*pages.Page](path + "/revisions"),
		searchTerms:   repositories.NewSearchTermListRepository(path + "/search_terms"),
		settings:      &repositories.SettingRepository{Path: filepath.Join(path, "setting.json")},
	}
}

func (m *dbManager) Init() error {
	if err := m.users.Init(); err != nil {
		return err
	}
	if err := m.userDevices.Init(); err != nil {
		return err
	}
	if err := m.pages.Init(); err != nil {
		return err
	}
	if err := m.keys.Init(); err != nil {
		return err
	}
	if err := m.pageRevisions.Init(); err != nil {
		return err
	}
	if err := m.searchTerms.Init(); err != nil {
		return err
	}
	return nil
}

func (m *dbManager) Users() users.UserRepository {
	return m.users
}

func (m *dbManager) UserDevices() users.UserDeviceRepository {
	return m.userDevices
}

func (m *dbManager) Pages() pages.PageRepository {
	return m.pages
}

func (m *dbManager) Keys() keymgmt.KeyRepository {
	return m.keys
}

func (m *dbManager) PageRevisions() revisions.RevisionRepository[*pages.Page] {
	return m.pageRevisions
}

func (m *dbManager) SearchTerms() pages.SearchTermListRepository {
	return m.searchTerms
}

func (m *dbManager) Settings() setting.SettingRepository {
	return m.settings
}
