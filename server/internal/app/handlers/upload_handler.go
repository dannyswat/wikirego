package handlers

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"mime"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"wikirego/internal/common/apihelper"
	"wikirego/internal/common/errors"
	"wikirego/internal/filemanager"
	"wikirego/internal/images"

	"github.com/labstack/echo/v4"
)

type UploadHandler struct {
	FileManager  filemanager.FileManager
	ImageResizer images.ImageResizer
}

type UploadFileRequest struct {
	FileBase64 string `json:"file" validate:"required"`
	FileName   string `json:"fileName" validate:"required"`
	Path       string `json:"path" validate:"required"`
}

func (uh *UploadHandler) UploadFile(e echo.Context) error {
	// Get the file from the request
	req := new(UploadFileRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	// Save the file to the media path
	fileBinary, err := base64.StdEncoding.DecodeString(req.FileBase64)
	if err != nil {
		return errors.BadRequest(err.Error())
	}
	err = uh.FileManager.SaveFile(fileBinary, req.FileName, req.Path)
	if err != nil {
		return errors.BadRequest(err.Error())
	}

	return e.JSON(200, "File uploaded successfully")
}

type CKEditorUploadRequest struct {
	Upload []byte `form:"upload" validate:"required"`
}

var (
	allowedExtensions    = []string{".jpg", ".jpeg", ".png", ".gif"}
	invalidFileNameChars = `[ \/:*?"<>|]`
)

func (uh *UploadHandler) CKEditorUpload(e echo.Context) error {
	req := new(CKEditorUploadRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	upload := e.Request().MultipartForm.File["upload"][0]
	file, err := upload.Open()
	if err != nil {
		return errors.BadRequest(err.Error())
	}
	defer file.Close()
	fileBinary, err := io.ReadAll(file)
	if err != nil {
		return errors.BadRequest(err.Error())
	}
	disposition := upload.Header.Get("Content-Disposition")
	_, mediaParams, err := mime.ParseMediaType(disposition)
	if err != nil {
		return errors.BadRequest(err.Error())
	}
	ext := filepath.Ext(mediaParams["filename"])
	onlyFileName := strings.TrimSuffix(filepath.Base(mediaParams["filename"]), ext)
	cleanFileName := regexp.MustCompile(invalidFileNameChars).ReplaceAllString(onlyFileName, "")
	fileName := fmt.Sprintf("%d_%s%s", time.Now().Unix(), cleanFileName, ext)
	path := "/uploads"

	if !slices.Contains(allowedExtensions, ext) {
		return errors.BadRequest("file extension not allowed")
	}

	err = uh.FileManager.SaveFile(fileBinary, fileName, path)
	if err != nil {
		return errors.BadRequest(err.Error())
	}

	// Resize the image
	if uh.ImageResizer != nil {
		resizedImage, err := uh.ImageResizer.ResizeImage(fileBinary)
		if err == nil {
			err = uh.FileManager.SaveFile(resizedImage, fileName, path+"/thumbnails")
			if err != nil {
				log.Println("failed to save thumbnail:", err)
			}
		} else {
			log.Println("failed to resize image:", err)
		}
	}

	return e.JSON(200, map[string]any{
		"uploaded": 1,
		"fileName": fileName,
		"url":      "/media" + path + "/" + fileName,
	})
}

func (uh *UploadHandler) ResizeAllImages(e echo.Context) error {
	// List all files in the uploads directory
	files, err := uh.FileManager.ListFiles("/uploads")
	if err != nil {
		return e.JSON(500, "failed to list files: "+err.Error())
	}

	count := 0
	for _, fileName := range files {
		ext := strings.ToLower(filepath.Ext(fileName))
		if !slices.Contains(allowedExtensions, ext) {
			continue
		}
		fileBinary, err := uh.FileManager.ReadFile(fileName, "/uploads")
		if err != nil {
			log.Println("failed to read file:", fileName, err)
			continue
		}
		resizedImage, err := uh.ImageResizer.ResizeImage(fileBinary)
		if err != nil {
			log.Println("failed to resize image:", fileName, err)
			continue
		}
		err = uh.FileManager.SaveFile(resizedImage, fileName, "/uploads/thumbnails")
		if err != nil {
			log.Println("failed to save thumbnail:", fileName, err)
			continue
		}
		count++
	}

	return e.JSON(200, fmt.Sprintf("Resized %d images", count))
}

func (uh *UploadHandler) CreatePath(e echo.Context) error {
	path := e.QueryParam("path")
	err := uh.FileManager.CreatePath(path)
	if err != nil {
		return errors.BadRequest(err.Error())
	}
	return e.JSON(200, "Path created successfully")
}

type SaveDiagramRequest struct {
	DiagramJson string `json:"diagram" validate:"required"`
	SvgContent  string `json:"svg" validate:"required"`
	PngContent  string `json:"png" validate:"required"`
	Id          string `json:"id" validate:"required"`
}

type SaveDiagramResponse struct {
	Id            string `json:"id"`
	DiagramSvgUrl string `json:"diagramSvgUrl"`
	DiagramPngUrl string `json:"diagramPngUrl"`
}

func (uh *UploadHandler) SaveDiagram(e echo.Context) error {
	req := new(SaveDiagramRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	err := uh.FileManager.SaveFile([]byte(req.DiagramJson), req.Id+".json", "/dgsource")
	if err != nil {
		return err
	}
	pngBinary, err := getPngBinaryFromBase64DataUrl(req.PngContent)
	if err != nil {
		return errors.BadRequest("invalid PNG content: " + err.Error())
	}
	err = uh.FileManager.SaveFile(pngBinary, req.Id+".png", "/diagrams")
	if err != nil {
		return err
	}
	err = uh.FileManager.SaveFile([]byte(req.SvgContent), req.Id+".svg", "/diagrams")
	if err != nil {
		return err
	}
	return e.JSON(200, &SaveDiagramResponse{
		Id:            req.Id,
		DiagramSvgUrl: "/media/diagrams/" + req.Id + ".svg",
		DiagramPngUrl: "/media/diagrams/" + req.Id + ".png",
	})
}

func (uh *UploadHandler) GetDiagramSource(e echo.Context) error {
	id := e.Param("id")
	if id == "" {
		return errors.BadRequest("invalid diagram id")
	}
	jsonBytes, err := uh.FileManager.ReadFile(id+".json", "/dgsource")
	if err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}

	return e.String(200, string(jsonBytes))
}

// Data Model (Modata) handlers

type SaveDataModelRequest struct {
	SchemaJson string `json:"schema" validate:"required"`
	PngContent string `json:"png" validate:"required"`
	Id         string `json:"id" validate:"required"`
}

type SaveDataModelResponse struct {
	Id              string `json:"id"`
	DataModelPngUrl string `json:"dataModelPngUrl"`
}

func (uh *UploadHandler) SaveDataModel(e echo.Context) error {
	req := new(SaveDataModelRequest)
	if err := e.Bind(req); err != nil {
		return errors.BadRequest(err.Error())
	}
	err := uh.FileManager.SaveFile([]byte(req.SchemaJson), req.Id+".json", "/umlsource")
	if err != nil {
		return err
	}
	pngBinary, err := getPngBinaryFromBase64DataUrl(req.PngContent)
	if err != nil {
		return errors.BadRequest("invalid PNG content: " + err.Error())
	}
	err = uh.FileManager.SaveFile(pngBinary, req.Id+".png", "/uml")
	if err != nil {
		return err
	}
	return e.JSON(200, &SaveDataModelResponse{
		Id:              req.Id,
		DataModelPngUrl: "/media/uml/" + req.Id + ".png",
	})
}

func (uh *UploadHandler) GetDataModelSource(e echo.Context) error {
	id := e.Param("id")
	if id == "" {
		return errors.BadRequest("invalid data model id")
	}
	jsonBytes, err := uh.FileManager.ReadFile(id+".json", "/umlsource")
	if err != nil {
		return apihelper.ReturnErrorResponse(e, err)
	}

	return e.String(200, string(jsonBytes))
}

func getPngBinaryFromBase64DataUrl(dataUrl string) ([]byte, error) {
	// Split the data URL into parts
	parts := strings.SplitN(dataUrl, ",", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid data URL format")
	}

	// Decode the base64 part
	return base64.StdEncoding.DecodeString(parts[1])
}
