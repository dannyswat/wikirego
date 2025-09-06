package repositories

import (
	"wikirego/internal/pages"

	"github.com/dannyswat/filedb"
)

type SearchTermListRepository struct {
	db filedb.FileDB[*pages.SearchTermList]
}

func NewSearchTermListRepository(path string) *SearchTermListRepository {
	return &SearchTermListRepository{
		db: filedb.NewFileDB[*pages.SearchTermList](path, []filedb.FileIndexConfig{
			{Field: "Term", Unique: true},
		}),
	}
}

func (r *SearchTermListRepository) Init() error {
	return r.db.Init()
}

func (r *SearchTermListRepository) GetSearchTermList(term string) (*pages.SearchTermList, error) {
	lists, err := r.db.List("Term", term)
	if err != nil {
		return nil, err
	}
	if len(lists) == 0 {
		return nil, nil
	}
	return lists[0], nil
}

func (r *SearchTermListRepository) UpdateSearchTermLists(terms, oldTerms []string, pageId int) error {
	added, removed := findDiff(oldTerms, terms)
	listToInsert := make([]*pages.SearchTermList, 0)
	listToUpdate := make([]*pages.SearchTermList, 0)
	listToDelete := make([]*pages.SearchTermList, 0)

	for _, term := range added {
		list, err := r.GetSearchTermList(term)
		if err != nil {
			return err
		}
		if list == nil {
			list = &pages.SearchTermList{Term: term, PageIds: []int{}}
			listToInsert = append(listToInsert, list)
		} else {
			listToUpdate = append(listToUpdate, list)
		}
		list.PageIds = append(list.PageIds, pageId)
	}

	for _, term := range removed {
		list, err := r.GetSearchTermList(term)
		if err != nil {
			return err
		}
		if list != nil {
			for i, id := range list.PageIds {
				if id == pageId {
					list.PageIds = append(list.PageIds[:i], list.PageIds[i+1:]...)
					break
				}
			}
			if len(list.PageIds) == 0 {
				listToDelete = append(listToDelete, list)
			} else {
				listToUpdate = append(listToUpdate, list)
			}
		}
	}

	if len(listToInsert) > 0 {
		for _, list := range listToInsert {
			if err := r.db.Insert(list); err != nil {
				return err
			}
		}
	}
	if len(listToUpdate) > 0 {
		for _, list := range listToUpdate {
			if err := r.db.Update(list); err != nil {
				return err
			}
		}
	}
	if len(listToDelete) > 0 {
		for _, list := range listToDelete {
			if err := r.db.Delete(list.ID); err != nil {
				return err
			}
		}
	}

	return nil
}

func (r *SearchTermListRepository) DeleteAll() error {
	entries, err := r.db.ListAll()
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := r.db.Delete(entry.ID); err != nil {
			return err
		}
	}
	return nil
}

func findDiff(oldTerms, newTerms []string) (added, removed []string) {
	oldSet := make(map[string]struct{}, len(oldTerms))
	for _, term := range oldTerms {
		oldSet[term] = struct{}{}
	}

	for _, term := range newTerms {
		if _, exists := oldSet[term]; !exists {
			added = append(added, term)
		}
	}

	for _, term := range oldTerms {
		if _, exists := oldSet[term]; !exists {
			removed = append(removed, term)
		}
	}

	return added, removed
}
