// 운영 로그를 한곳에서 관리합니다. 이후 외부 로깅 서비스로 교체하기 쉽게 감싸둡니다.
const logInfo = (event, details = {}) => {
  console.info('[server:info]', {
    event,
    at: new Date().toISOString(),
    ...details
  });
};

const logError = (event, details = {}) => {
  console.error('[server:error]', {
    event,
    at: new Date().toISOString(),
    ...details
  });
};

module.exports = {
  logInfo,
  logError
};
