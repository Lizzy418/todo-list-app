# Todo List

React + Express 기반 Todo 앱입니다. 로그인은 JWT를 사용하고, 운영 환경에서는 PostgreSQL에 사용자별 Todo 데이터를 저장합니다. `DATABASE_URL`이 없으면 로컬 개발/테스트용 SQLite 파일을 사용합니다.

## 주요 기능

- 이메일/비밀번호 회원가입 및 로그인
- JWT 세션 유지와 로그아웃
- 사용자별 Todo 분리 저장
- Todo 추가, 수정, 삭제, 완료 체크
- 필터, 검색, 마감일, 우선순위, 태그
- 완료 항목 전체 삭제
- 통계 표시

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run migrate
npm run dev
```

- 프론트엔드: `http://127.0.0.1:3000`
- API 서버: `http://127.0.0.1:4000`

포트 `3000`이 이미 사용 중이면 Vite가 `3001`로 올라갈 수 있습니다. 이 경우 `.env`의 `CLIENT_ORIGIN`에 해당 주소가 포함되어 있어야 합니다.

## 환경변수

```bash
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:3000,http://127.0.0.1:3001
JWT_SECRET=replace-this-dev-secret
JWT_EXPIRES_IN=7d
DATABASE_URL=postgres://user:password@host:5432/database
PGSSLMODE=require
DATABASE_FILE=server/data/todolist.sqlite
```

- `DATABASE_URL`: PostgreSQL 연결 문자열입니다. 운영 환경에서는 필수로 설정하세요.
- `DATABASE_FILE`: `DATABASE_URL`이 없을 때만 사용하는 SQLite 개발용 파일입니다.
- `JWT_SECRET`: 운영 환경에서는 긴 랜덤 문자열로 설정하세요.
- `CLIENT_ORIGIN`: 브라우저에서 접근하는 프론트 주소입니다. 쉼표로 여러 개를 지정할 수 있습니다.
- `VITE_API_BASE_URL`: 개발 중 프론트가 호출할 API 주소입니다. 미설정 시 개발 모드에서는 `http://127.0.0.1:4000`, 운영 빌드에서는 같은 origin을 사용합니다.

`.env`는 `.gitignore`에 포함되어 있으므로 저장소에 올리지 않습니다.

## PostgreSQL 준비

로컬 PostgreSQL을 쓰려면 `.env`에 `DATABASE_URL`을 설정한 뒤 마이그레이션을 실행합니다.

```bash
npm run migrate
```

생성되는 테이블:

- `users`: `id`, `email`, `password_hash`, `created_at`
- `todos`: `id`, `user_id`, `text`, `completed`, `due_date`, `priority`, `tags`, `created_at`, `updated_at`

## 스크립트

```bash
npm run dev:client
npm run dev:server
npm run dev
npm run migrate
npm run build
npm run start
npm test
```

## 배포

Render/Railway 같은 플랫폼에서 다음 값을 설정합니다.

- Build command: `npm install && npm run build && npm run migrate`
- Start command: `npm run start`
- Environment:
  - `NODE_ENV=production`
  - `PORT`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN=7d`
  - `CLIENT_ORIGIN=https://your-app-domain.example`
  - `PGSSLMODE=require`

운영 모드에서는 Express가 `dist/`의 React 빌드 결과를 함께 서빙합니다. 프론트와 API를 같은 서비스에서 제공하는 경우 `VITE_API_BASE_URL`은 비워둘 수 있습니다.

## 검증

```bash
npm test -- --run
npm run build
```
