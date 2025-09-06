package repositories

import (
	"strconv"

	"wikirego/internal/revisions"

	"github.com/dannyswat/filedb"
)

const (
	DateFormat = "2006-01-02 15:04:05"
)

type RevisionRepository[T interface{}] struct {
	db filedb.FileDB[*revisions.Revision[T]]
}

func NewRevisionRepository[T interface{}](path string) revisions.RevisionRepository[T] {
	return &RevisionRepository[T]{
		db: filedb.NewFileDB[*revisions.Revision[T]](path, []filedb.FileIndexConfig{
			{Field: "RecordID", Unique: false},
		}),
	}
}

func (r *RevisionRepository[T]) Init() error {
	return r.db.Init()
}

func (r *RevisionRepository[T]) GetLatestRevision(recordID int) (*revisions.Revision[T], error) {
	entries, err := r.db.ListIndexFields("RecordID", strconv.Itoa(recordID))
	if err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, nil
	}
	var latest *filedb.IndexEntry
	for _, entry := range entries {
		if latest == nil || entry.ID > latest.ID {
			latest = entry
		}
	}
	if latest == nil {
		return nil, nil
	}
	return r.db.Find(latest.ID)
}

func (r *RevisionRepository[T]) AddRevision(e *revisions.Revision[T]) error {
	return r.db.Insert(e)
}
