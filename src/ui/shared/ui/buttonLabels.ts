export const EDIT_LABEL = "Правка";

export function editName(recordRu: string): string {
  return `${EDIT_LABEL}: ${recordRu}`;
}

export const BUTTON_LABELS = {
  save: "Сохранить",
  write: "Записать",
  confirm: "Подтвердить",
  dismiss: "Отмена",
  undo: "Вернуть",
  remove: "Убрать",
} as const;
