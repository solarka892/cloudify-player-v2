import { ApiError } from "@/api/invoke";

/** What went wrong, in plain words — never a status code. */
export function describeError(error: unknown): string {
  const { kind, message } = ApiError.from(error);
  switch (kind) {
    case "network":
      return "Нет связи с SoundCloud. Проверь интернет.";
    case "unauthorized":
      return "Вход устарел: SoundCloud больше не принимает старый ключ. Войди заново.";
    case "sign-in-required":
      return "Сначала нужно войти в SoundCloud.";
    case "bot-filtered":
      return "SoundCloud не пустил: сработала его защита от ботов. С твоим входом всё в порядке.";
    case "forbidden":
      return "SoundCloud не дал к этому доступа.";
    case "not-found":
      return "На SoundCloud этого больше нет.";
    case "rate-limited":
      return "SoundCloud просит подождать: слишком много запросов подряд.";
    case "not-available":
      return "Здесь это не сыграет: SoundCloud не отдаёт трек в твоём регионе или без защиты.";
    case "client-id":
      return "Не получилось подключиться: SoundCloud что-то поменял у себя.";
    case "invalid-input":
      return "Это не похоже на ключ входа SoundCloud.";
    case "keychain":
      return "Система не дала сохранить вход в связку ключей.";
    case "storage":
      return "Файл дневника на этом компьютере не открывается или не записывается.";
    case "decode":
    case "api":
      return "SoundCloud ответил что-то непонятное.";
    case "app":
      return message;
  }
}
