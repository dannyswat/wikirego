package setting

import (
	"strings"
	"wikirego/internal/common"
	"wikirego/internal/common/caching"
	"wikirego/internal/common/errors"
)

type SettingService struct {
	DB            SettingRepository
	Cache         *caching.SimpleCache[*Setting]
	SecurityCache *caching.SimpleCache[*SecuritySetting]
}

func (s *SettingService) Init(initial *Setting, initialSecurity *SecuritySetting) error {
	return s.DB.Init(initial, initialSecurity)
}

func (s *SettingService) GetSetting() (*Setting, error) {
	setting, err := s.DB.GetSetting()
	if err != nil {
		return nil, err
	}
	return setting, nil
}
func (s *SettingService) GetSecuritySetting() (*SecuritySetting, error) {
	securitySetting, err := s.DB.GetSecuritySetting()
	if err != nil {
		return nil, err
	}
	return securitySetting, nil
}
func (s *SettingService) UpdateSetting(setting *Setting) error {
	if err := ValidateSetting(setting); err != nil {
		return err
	}
	err := s.DB.UpdateSetting(setting)
	if err == nil {
		cached, ok := s.Cache.Get()
		if ok && cached != nil {
			if cached.IsSiteProtected != setting.IsSiteProtected {
				go common.ExitApplication()
			}
		}
		s.Cache.Set(setting)
	}
	return err
}
func (s *SettingService) UpdateSecuritySetting(securitySetting *SecuritySetting) error {
	if err := ValidateSecuritySetting(securitySetting); err != nil {
		return err
	}
	err := s.DB.UpdateSecuritySetting(securitySetting)
	if err == nil {
		s.SecurityCache.Set(securitySetting)
	}
	return err
}

func ValidateSetting(setting *Setting) error {
	if setting.SiteURL != "" {
		if !strings.HasPrefix(setting.SiteURL, "http://") && !strings.HasPrefix(setting.SiteURL, "https://") {
			return errors.NewValidationError("SiteURL must start with http:// or https://", "SiteURL")
		}
	}
	return nil
}

func ValidateSecuritySetting(securitySetting *SecuritySetting) error {
	return nil
}
