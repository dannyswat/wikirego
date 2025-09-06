package repositories

import (
	"encoding/json"
	"os"

	"wikirego/internal/setting"
)

type SettingRepository struct {
	Path string
}

// internal struct for file storage
type settingsFile struct {
	Setting  setting.Setting         `json:"setting"`
	Security setting.SecuritySetting `json:"security"`
}

func (r *SettingRepository) Init(initial *setting.Setting, initialSecurity *setting.SecuritySetting) error {
	if _, err := os.Stat(r.Path); os.IsNotExist(err) {
		defaultFile := settingsFile{
			Setting:  *initial,
			Security: *initialSecurity,
		}
		data, err := json.MarshalIndent(defaultFile, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(r.Path, data, 0644)
	}
	return nil
}

func (r *SettingRepository) GetSetting() (*setting.Setting, error) {
	if _, err := os.Stat(r.Path); os.IsNotExist(err) {
		return nil, nil
	}
	file, err := os.Open(r.Path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	var f settingsFile
	if err := json.NewDecoder(file).Decode(&f); err != nil {
		return nil, err
	}
	return &f.Setting, nil
}

func (r *SettingRepository) GetSecuritySetting() (*setting.SecuritySetting, error) {
	if _, err := os.Stat(r.Path); os.IsNotExist(err) {
		return nil, nil
	}
	file, err := os.Open(r.Path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	var f settingsFile
	if err := json.NewDecoder(file).Decode(&f); err != nil {
		return nil, err
	}
	return &f.Security, nil
}

func (r *SettingRepository) UpdateSetting(s *setting.Setting) error {
	// Read current file
	f := settingsFile{}
	file, err := os.Open(r.Path)
	if err == nil {
		_ = json.NewDecoder(file).Decode(&f)
		file.Close()
	}
	f.Setting = *s
	newData, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.Path, newData, 0644)
}

func (r *SettingRepository) UpdateSecuritySetting(sec *setting.SecuritySetting) error {
	// Read current file
	f := settingsFile{}
	file, err := os.Open(r.Path)
	if err == nil {
		_ = json.NewDecoder(file).Decode(&f)
		file.Close()
	}
	f.Security = *sec
	newData, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.Path, newData, 0644)
}
