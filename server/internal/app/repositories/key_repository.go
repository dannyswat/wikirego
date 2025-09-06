package repositories

import (
	"wikirego/internal/keymgmt"

	"github.com/dannyswat/filedb"
)

type keyDB struct {
	db filedb.FileDB[*keymgmt.KeyPair]
}

func NewKeyDB(path string) keymgmt.KeyRepository {
	return &keyDB{
		db: filedb.NewFileDB[*keymgmt.KeyPair](path, []filedb.FileIndexConfig{
			{Field: "Purpose", Unique: true},
		}),
	}
}

func (k *keyDB) Init() error {
	return k.db.Init()
}

func (k *keyDB) GetKeyPairByPurpose(purpose string) (*keymgmt.KeyPair, error) {
	key, err := k.db.List("Purpose", purpose)
	if err != nil {
		return nil, err
	}
	if len(key) == 0 {
		return nil, nil
	}
	return key[0], nil
}

func (k *keyDB) CreateKeyPair(key *keymgmt.KeyPair) error {
	return k.db.Insert(key)
}

func (k *keyDB) UpdateKeyPair(key *keymgmt.KeyPair) error {
	return k.db.Update(key)
}

func (k *keyDB) DeleteKeyPair(id int) error {
	return k.db.Delete(id)
}
