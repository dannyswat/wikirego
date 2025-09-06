package handlers

import (
	"encoding/base64"
	"path/filepath"
	"strings"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/filemanager"

	"github.com/labstack/echo/v4"
)

type FileHandler struct {
	FileManager filemanager.FileManager
}

type FileItem struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size,omitempty"`
	Extension string `json:"extension,omitempty"`
}

type ListFilesResponse struct {
	Files       []FileItem `json:"files"`
	CurrentPath string     `json:"currentPath"`
}

type ReadFileResponse struct {
	Content  string `json:"content"`
	FileName string `json:"fileName"`
	Path     string `json:"path"`
}

// ListFiles handles GET /api/files/list
func (fh *FileHandler) ListFiles(e echo.Context) error {
	path := e.QueryParam("path")
	if path == "" {
		path = "/"
	}

	// Ensure path starts with /
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	files, err := fh.FileManager.ListFiles(path)
	if err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}

	var fileItems []FileItem

	for _, fileName := range files {
		if fileName == "" {
			continue
		}

		// For simplicity, we'll assume all items in the list are files unless we can check
		// We'll add basic file info without accessing the file system directly
		var extension string
		isDir := false

		// Simple heuristic: if no extension, might be a directory
		if filepath.Ext(fileName) == "" {
			isDir = true
		} else {
			extension = strings.ToLower(filepath.Ext(fileName))
		}

		fileItems = append(fileItems, FileItem{
			Name:      fileName,
			Path:      filepath.Join(path, fileName),
			IsDir:     isDir,
			Size:      0, // We'll populate this in a separate call if needed
			Extension: extension,
		})
	}

	response := ListFilesResponse{
		Files:       fileItems,
		CurrentPath: path,
	}

	return e.JSON(200, response)
}

// ReadFile handles GET /api/files/read
func (fh *FileHandler) ReadFile(e echo.Context) error {
	fileName := e.QueryParam("fileName")
	path := e.QueryParam("path")

	if fileName == "" {
		return errors.NewValidationError("fileName parameter is required", "fileName")
	}

	if path == "" {
		path = "/"
	}

	// Ensure path starts with /
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	fileContent, err := fh.FileManager.ReadFile(fileName, path)
	if err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}

	// Check if file is binary by checking for null bytes
	isBinary := false
	for _, b := range fileContent {
		if b == 0 {
			isBinary = true
			break
		}
	}

	var content string
	if isBinary {
		// Return base64 encoded content for binary files
		content = base64.StdEncoding.EncodeToString(fileContent)
	} else {
		// Return plain text content for text files
		content = string(fileContent)
	}

	response := ReadFileResponse{
		Content:  content,
		FileName: fileName,
		Path:     path,
	}

	return e.JSON(200, response)
}

// GetFileInfo handles GET /api/files/info
func (fh *FileHandler) GetFileInfo(e echo.Context) error {
	fileName := e.QueryParam("fileName")
	path := e.QueryParam("path")

	if fileName == "" {
		return errors.NewValidationError("fileName parameter is required", "fileName")
	}

	if path == "" {
		path = "/"
	}

	// Ensure path starts with /
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	// Try to read the file to verify it exists
	_, err := fh.FileManager.ReadFile(fileName, path)
	if err != nil {
		return errors.NotFoundf("file %s not found in path", fileName)
	}

	var extension string
	isDir := false

	// Simple heuristic: if no extension, might be a directory
	if filepath.Ext(fileName) == "" {
		isDir = true
	} else {
		extension = strings.ToLower(filepath.Ext(fileName))
	}

	fileItem := FileItem{
		Name:      fileName,
		Path:      filepath.Join(path, fileName),
		IsDir:     isDir,
		Size:      0, // Size will be determined when actually reading the file
		Extension: extension,
	}

	return e.JSON(200, fileItem)
}
