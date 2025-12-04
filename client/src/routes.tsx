import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./features/auth/LoginPage";
import Page from "./features/pages/Page";
import EditPage from "./features/pages/EditPage";
import NewPage from "./features/pages/NewPage";
import LayoutMain from "./features/layout/LayoutMain";
import GuardedRoute from "./features/auth/GuardedRoute";
import EditorRoute from "./features/auth/EditorRoute";
import LayoutEdit from "./features/layout/LayoutEdit";
import ChangePasswordPage from "./features/useraccount/ChangePasswordPage";
import AdminRoute from "./features/auth/AdminRoute";
import Users from "./features/users/Users";
import UsersCreate from "./features/users/UsersCreate";
import LayoutAdmin from "./features/layout/LayoutAdmin";
import UsersEdit from "./features/users/UsersEdit";
import EditorMenu from "./features/editors/EditorMenu";
import CreateAdmin from "./features/setup/CreateAdmin";
import CreateSetting from "./features/setup/CreateSetting";
import SiteSetting from "./features/settings/SiteSetting";
import SecuritySetting from "./features/settings/SecuritySetting";
import Search from "./features/pages/Search";
import FileBrowser from "./features/filemanager/FileBrowser";
import AdminOps from "./features/admin/AdminOps";

export function WikiRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<LayoutMain isPage />}>
          <Route path="/" element={<Page />} />
          <Route path="/p/:id/:id2?/:id3?/:id4?/:id5?" element={<Page />} />
          <Route path="/search" element={<Search />} />
        </Route>
        <Route element={<GuardedRoute />}>
          <Route element={<EditorRoute />}>
            <Route element={<LayoutEdit customMenu={<EditorMenu />} />}>
              <Route path="create" element={<NewPage />} />
              <Route
                path="edit/:id/:id2?/:id3?/:id4?/:id5?"
                element={<EditPage />}
              />
            </Route>
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<LayoutAdmin />}>
              <Route path="/filebrowser" element={<FileBrowser />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/create" element={<UsersCreate />} />
              <Route path="/users/:id" element={<UsersEdit />} />
              <Route path="/site-setting" element={<SiteSetting />} />
              <Route path="/security-setting" element={<SecuritySetting />} />
              <Route path="/page-admin" element={<AdminOps />} />
            </Route>
          </Route>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function SetupRoutes() {
  return (
    <BrowserRouter >
      <Routes>
        <Route path="/setup-admin" element={<CreateAdmin />} />
        <Route path="/setup-site" element={<CreateSetting />} />
        <Route path="*" element={<Navigate to="/setup-admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}