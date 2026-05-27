import sys
import json
import pandas as pd
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        print('Usage: export_results_json.py <input_xlsx> <output_json>')
        sys.exit(1)
    in_xlsx = Path(sys.argv[1])
    out_json = Path(sys.argv[2])

    if not in_xlsx.exists():
        print(f'Input file not found: {in_xlsx}')
        sys.exit(2)

    # Read all sheets and attempt to extract assignments table if present
    try:
        xls = pd.read_excel(in_xlsx, sheet_name=None)
    except Exception as e:
        print('Failed to read xlsx:', e)
        sys.exit(3)

    # Heuristic: find a sheet that contains columns like 'Shift' or 'Invigilator'
    assignments = []
    for name, df in xls.items():
        cols = [c.lower() for c in df.columns.astype(str)]
        if any('shift' in c or 'ca' in c for c in cols) and any('invigilator' in c or 'staff' in c or 'cán bộ' in c for c in cols):
            # Normalize rows
            for _, row in df.iterrows():
                try:
                    shift = None
                    staff = []
                    for c in df.columns:
                        val = row.get(c)
                        if pd.isna(val):
                            continue
                        key = str(c).lower()
                        if 'shift' in key or 'ca' in key or 'mã' in key:
                            shift = str(val)
                        if 'invigilator' in key or 'staff' in key or 'cán bộ' in key or 'tên' in key:
                            staff.append(str(val))
                    if shift and staff:
                        assignments.append({'shiftId': shift, 'staffNames': staff, 'staffIds': staff})
                except Exception:
                    continue

    # Fallback: if no assignments found, try to serialize first sheet
    if not assignments and len(xls) > 0:
        df = list(xls.values())[0]
        for _, row in df.head(200).iterrows():
            assignments.append({ 'row': row.dropna().to_dict() })

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps({'assignments': assignments}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('WROTE', str(out_json))

if __name__ == '__main__':
    main()
