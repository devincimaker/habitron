export const TODO_TAG_COLOR_PALETTE = [
  '#E57373',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#A1887F',
  '#90A4AE',
  '#26A69A',
] as const;

function hashTagName(value: string) {
  let hash = 5381;

  for (const character of value.toLowerCase()) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }

  return Math.abs(hash);
}

export function getTodoTagColor(name: string) {
  return TODO_TAG_COLOR_PALETTE[
    hashTagName(name.trim()) % TODO_TAG_COLOR_PALETTE.length
  ];
}

export function getTodoTagTintColor(color?: string, alpha = '20') {
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return undefined;
  }

  return `${color}${alpha}`;
}
