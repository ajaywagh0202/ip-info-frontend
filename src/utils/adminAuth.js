export function getToken() {
  return localStorage.getItem('token') || localStorage.getItem('adminToken');
}

export function getUserType() {
  const value = localStorage.getItem('user_type');
  return value === null || value === undefined ? null : Number(value);
}

export function isSuperUser() {
  return getUserType() === 0 || getUserType() === null;
}

export function getAdminProfile() {
  return {
    token: getToken(),
    user_type: getUserType(),
    dept_code: localStorage.getItem('dept_code') || '',
    dept_name: localStorage.getItem('dept_name') || '',
    name: localStorage.getItem('name') || '',
    username: localStorage.getItem('username') || '',
    designation: localStorage.getItem('designation') || '',
  };
}

export function saveAdminSession(data = {}) {
  const token = data.token || data.accessToken || data.jwt;
  const userType = data.user_type ?? data.userType ?? data.user?.user_type;
  const deptCode = data.dept_code ?? data.deptCode ?? data.user?.dept_code;
  const deptName = data.dept_name ?? data.deptName ?? data.user?.dept_name;
  const name = data.name ?? data.user?.name;
  const username = data.username ?? data.user?.username;
  const designation = data.designation ?? data.user?.designation;

  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('adminToken', token);
  }
  if (userType !== undefined && userType !== null) localStorage.setItem('user_type', String(userType));
  if (deptCode !== undefined && deptCode !== null) localStorage.setItem('dept_code', String(deptCode));
  if (deptName !== undefined && deptName !== null) localStorage.setItem('dept_name', String(deptName));
  if (name !== undefined && name !== null) localStorage.setItem('name', String(name));
  if (username !== undefined && username !== null) localStorage.setItem('username', String(username));
  if (designation !== undefined && designation !== null) localStorage.setItem('designation', String(designation));
}

export function clearAdminSession() {
  localStorage.clear();
}
