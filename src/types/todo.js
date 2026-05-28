// Todo 객체의 모양을 JSDoc으로 기록하는 파일입니다.
// JavaScript 프로젝트에서도 데이터 구조를 한곳에서 확인할 수 있게 해줍니다.

/**
 * @typedef {Object} Todo
 * @property {string} id - 할 일을 구분하는 고유 ID입니다.
 * @property {string} title - 화면에 표시되는 할 일 제목입니다.
 * @property {boolean} completed - 완료 여부입니다.
 * @property {string} createdAt - 생성 시각입니다. ISO 문자열 형식을 사용합니다.
 * @property {string} dueDate - 마감일입니다. 값이 없으면 빈 문자열, 있으면 YYYY-MM-DD 형식입니다.
 * @property {'high' | 'normal' | 'low'} priority - 우선순위입니다.
 * @property {string[]} tags - 사용자가 지정한 태그 목록입니다.
 */

export {};
