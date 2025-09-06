package repositories

import (
	"strconv"
	"wikirego/internal/users"

	"github.com/dannyswat/filedb"
)

type userDeviceDB struct {
	db filedb.FileDB[*users.UserDevice]
}

func NewUserDeviceDB(path string) users.UserDeviceRepository {
	return &userDeviceDB{
		db: filedb.NewFileDB[*users.UserDevice](path, []filedb.FileIndexConfig{
			{Field: "UserID", Unique: false},
			{Field: "CredentialID", Unique: true},
		}),
	}
}

func (u *userDeviceDB) Init() error {
	return u.db.Init()
}

func (u *userDeviceDB) GetByID(id int) (*users.UserDevice, error) {
	device, err := u.db.Find(id)
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (u *userDeviceDB) GetByCredentialID(credentialID string) (*users.UserDevice, error) {
	devices, err := u.db.List("CredentialID", credentialID)
	if err != nil {
		return nil, err
	}
	if len(devices) == 0 {
		return nil, nil
	}
	return devices[0], nil
}

func (u *userDeviceDB) GetByUserID(userID int) ([]*users.UserDevice, error) {
	return u.db.List("UserID", strconv.Itoa(userID))
}

func (u *userDeviceDB) CreateDevice(device *users.UserDevice) error {
	return u.db.Insert(device)
}

func (u *userDeviceDB) UpdateDevice(device *users.UserDevice) error {
	return u.db.Update(device)
}

func (u *userDeviceDB) DeleteDevice(id int) error {
	return u.db.Delete(id)
}
