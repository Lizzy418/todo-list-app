// 태그 입력과 표시에서 함께 쓰는 정규화 로직입니다.

export const normalizeTags = (tags) =>
  Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );

export const parseTagInput = (tagInput) => normalizeTags(tagInput.split(','));
