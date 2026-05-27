import type { Shift } from './mock-data';

/** Chuẩn hóa tên cơ sở (đồng bộ với Python _normalize_facility). CS2 trước CS1. */
export function normalizeFacility(facility: string): string {
  const raw = (facility || '').trim();
  const lower = raw.toLowerCase();
  if (
    /\bcs\s*2\b/i.test(lower) ||
    /cơ\s*sở\s*2/i.test(lower) ||
    /co\s*so\s*2/i.test(lower) ||
    /^2$/.test(lower) ||
    (lower.includes('so') && /(^|\s)2(\s|$)/.test(lower))
  ) {
    return 'Cơ sở 2';
  }
  if (
    /\bcs\s*1\b/i.test(lower) ||
    /cơ\s*sở\s*1/i.test(lower) ||
    /co\s*so\s*1/i.test(lower) ||
    /^1$/.test(lower) ||
    (lower.includes('so') && /(^|\s)1(\s|$)/.test(lower))
  ) {
    return 'Cơ sở 1';
  }
  return raw;
}

/** Khóa duy nhất = mã ca + cơ sở (trùng UNIQUE_KEY phía Python). */
export function shiftKey(shift: Pick<Shift, 'id' | 'facility'>): string {
  return `${shift.id}|${normalizeFacility(shift.facility)}`;
}

/** Gộp chỉ khi trùng cả mã ca lẫn cơ sở — không gộp cùng mã khác cơ sở. */
export function aggregateShifts(shifts: Shift[]): Shift[] {
  const map = new Map<string, Shift>();
  for (const s of shifts) {
    const normalized: Shift = {
      ...s,
      facility: normalizeFacility(s.facility),
    };
    const key = shiftKey(normalized);
    const prev = map.get(key);
    if (prev) {
      prev.staffRequired += normalized.staffRequired;
    } else {
      map.set(key, { ...normalized });
    }
  }
  return Array.from(map.values());
}

export function extractFacilityFromAssignmentShiftId(shiftId: string): string {
  const inParens = shiftId.match(/\(([^)]+)\)\s*$/);
  if (inParens) return normalizeFacility(inParens[1]);
  if (/Cơ sở\s*2|CS2|cs2/i.test(shiftId)) return 'Cơ sở 2';
  if (/Cơ sở\s*1|CS1|cs1/i.test(shiftId)) return 'Cơ sở 1';
  return '';
}

/** Trích mã ca dạng 20260528_3 từ shiftId kết quả solver. */
export function extractShiftIdFromAssignmentShiftId(shiftId: string): string {
  const segment = shiftId.includes(' - ') ? shiftId.split(' - ').slice(1).join(' - ').trim() : shiftId;
  const dateMatch = segment.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const caMatch = segment.match(/Ca\s*(\d+)/i);
  if (dateMatch && caMatch) {
    const yyyy = dateMatch[3];
    const mm = dateMatch[2].padStart(2, '0');
    const dd = dateMatch[1].padStart(2, '0');
    return `${yyyy}${mm}${dd}_${caMatch[1]}`;
  }
  const direct = shiftId.match(/\d{8}_\d+/);
  return direct ? direct[0] : '';
}

/** Cặp (mã ca, cơ sở) — bắt buộc đủ cả hai mới so khớp yêu cầu nhân sự. */
export function assignmentSlotKey(
  assignmentShiftId: string
): { id: string; facility: string } | null {
  const id = extractShiftIdFromAssignmentShiftId(assignmentShiftId);
  const facility = extractFacilityFromAssignmentShiftId(assignmentShiftId);
  if (!id || !facility) return null;
  return { id, facility };
}

export function findShiftBySlot(
  shifts: Shift[],
  id: string,
  facility: string
): Shift | undefined {
  const fac = normalizeFacility(facility);
  return aggregateShifts(shifts).find(
    (s) => s.id === id && normalizeFacility(s.facility) === fac
  );
}

export function getRequiredStaffForAssignment(
  assignmentShiftId: string,
  shifts: Shift[]
): number | null {
  const slot = assignmentSlotKey(assignmentShiftId);
  if (!slot) return null;
  return findShiftBySlot(shifts, slot.id, slot.facility)?.staffRequired ?? null;
}
