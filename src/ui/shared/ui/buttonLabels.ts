export const EDIT_LABEL = "Правка";

export function editName(recordRu: string): string {
  return `${EDIT_LABEL}: ${recordRu}`;
}

export const BUTTON_LABELS = {
  save: "Сохранить",
  confirm: "Подтвердить",
  dismiss: "Отмена",
  undo: "Вернуть",
} as const;
