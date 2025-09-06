package repositories

import (
	"wikirego/internal/users"

	"github.com/dannyswat/filedb"
)

type userDB struct {
	db filedb.FileDB[*users.User]
}

func NewUserDB(path string) users.UserRepository {
	return &userDB{
		db: filedb.NewFileDB[*users.User](path, []filedb.FileIndexConfig{
			{Field: "UserName", Unique: true},
			{Field: "Email", Unique: true},
		}),
	}
}

func (u *userDB) Init() error {
	return u.db.Init()
}

func (u *userDB) GetUserByID(id int) (*users.User, error) {
	user, err := u.db.Find(id)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (u *userDB) GetUserByUserName(username string) (*users.User, error) {
	users, err := u.db.List("UserName", username)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}
	return users[0], nil
}

func (u *userDB) GetUserByEmail(email string) (*users.User, error) {
	users, err := u.db.List("Email", email)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}
	return users[0], nil
}

func (u *userDB) CreateUser(user *users.User) error {
	return u.db.Insert(user)
}

func (u *userDB) UpdateUser(user *users.User) error {
	return u.db.Update(user)
}

func (u *userDB) DeleteUser(id int) error {
	return u.db.Delete(id)
}

func (u *userDB) ListAll() ([]*users.User, error) {
	return u.db.ListAll()
}
