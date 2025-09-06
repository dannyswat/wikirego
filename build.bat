cd %~dp0
rmdir /s /q build
mkdir build
mkdir build\data
copy release\* build
mkdir build\views
copy server\views\* build\views
cd server
go build -o ..\build\wikirego.exe .\cmd\web\main.go
cd ..\client
npm run build
