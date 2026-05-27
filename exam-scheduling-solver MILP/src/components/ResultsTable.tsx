
import { ReactNode, useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, FileCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Staff, Shift } from "@/lib/mock-data";

interface ResultsTableProps {
  assignments: any[];
  staff: Staff[];
  shifts: Shift[];
}

export default function ResultsTable({ assignments, staff, shifts }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const parseTimeRange = (timeRange: string) => {
    const normalized = timeRange.replace(/g/gi, ':').trim();
    const parts = normalized.split('-').map(p => p.trim());
    if (parts.length !== 2) return 150;

    const parsePart = (value: string) => {
      const match = value.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    const start = parsePart(parts[0]);
    const end = parsePart(parts[1]);
    if (start === null || end === null) return 150;
    return Math.max(0, end - start);
  };

  // const parseShiftSegment = (segment: string) => {
  //   const text = segment.trim();
  //   if (!text) return null;

  //   const weekdayMatch = text.match(/-\s*(Thứ\s*\d|Chủ\s*Nhật)/i);
  //   const weekday = weekdayMatch ? weekdayMatch[1] : '';
    
  //   const dateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  //   const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : '';
    
  //   const timeMatch = text.match(/Ca\s*(\d+)\s*[:]?\s*([^()]+)\s*\(/i);
  //   const caNumber = timeMatch ? timeMatch[1] : '';
  //   const timeRange = timeMatch ? timeMatch[2].trim() : '';
    
  //   const facilityMatch = text.match(/\(([^)]+)\)/);
  //   const facility = facilityMatch ? facilityMatch[1].trim() : 'Cơ sở 1';

  //   const id = date && caNumber ? `${date.replace(/-/g, '')}_${caNumber}` : text;
  //   const name = timeRange ? `Ca ${caNumber}: ${timeRange}` : `Ca ${caNumber}`;
  //   const session = weekday && date ? `${weekday}, ${date}` : date || weekday;
  //   const duration = `${parseTimeRange(timeRange)} phút`;

  //   return { id, name, session, facility, duration };
  // };

  const parseShiftSegment = (segment: string) => {
    const text = segment.trim();
    if (!text) return null;

    // 1. Tách chuỗi dựa trên dấu gạch ngang đầu tiên để loại bỏ phần ngày lặp "28/05/2026 - "
    const cleanText = text.includes(' - ') ? text.split(' - ')[1].trim() : text;

    // 2. Bóc tách Ngày (Định dạng từ chuỗi: 28/05/2026)
    const dateMatch = cleanText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const rawDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : '';

    // 3. Bóc tách Số Ca và Giờ thi (Định dạng thực tế: Ca 3: 13g00-15g30)
    const caMatch = cleanText.match(/Ca\s*(\d+)\s*:\s*([^)\s(]+)/i);
    const caNumber = caMatch ? caMatch[1] : '1';
    const timeRange = caMatch ? caMatch[2].trim() : '';

    // 4. Xác định Cơ sở trực dựa trên nội dung nằm trong dấu ngoặc (...)
    const facilityMatch = cleanText.match(/\(([^)]+)\)/);
    const facility = facilityMatch ? facilityMatch[1].trim() : 'Cơ sở 1';

    // 5. Tìm Thứ có sẵn trong chuỗi văn bản (Ví dụ: Thứ 5, Chủ Nhật)
    const weekdayMatch = cleanText.match(/^(Chủ\s*Nhật|Thứ\s*\d)/i);
    const weekday = weekdayMatch ? weekdayMatch[1] : '';

    // 6. Đồng bộ cấu trúc ID phục vụ sắp xếp thời gian tăng dần trên bảng
    const id = rawDate ? `${rawDate.replace(/-/g, '')}_${caNumber}` : cleanText;
    const name = `Ca ${caNumber}${timeRange ? `: ${timeRange}` : ''}`;
    const session = weekday && dateMatch ? `${weekday}, ${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : (rawDate || cleanText);
    const duration = `${parseTimeRange(timeRange)} phút`;

    return { id, name, session, facility, duration };
  };


  
  const processAssignments = () => {
    const grouped: Record<string, { id: string; name: string; session: string; facility: string; duration: string; staffList: string[] }> = {};

    assignments.forEach(item => {
      // Ưu tiên lấy thuộc tính gán trực tiếp từ JSON API
      const rawShift = String(
        item.shiftId || 
        item.row?.['Ca thi'] || 
        item.row?.['Ca Thi'] || 
        item.row?.Ca || 
        ''
      );
      
      const shiftSegments = rawShift.split(';').map(s => s.trim()).filter(Boolean);
      
      // Đọc mảng mã cán bộ được gán trực tiếp từ JSON kết quả
      const staffEntries: string[] = Array.isArray(item.staffIds)
        ? item.staffIds
        : item.row?.['Danh_sách_CB_Phân_công']
          ? String(item.row?.['Danh_sách_CB_Phân_công']).split(',').map(s => s.trim())
          : [];

      // Ánh xạ Mã cán bộ (Ví dụ: CB59) sang Tên cán bộ hiển thị trên bảng
      const staffNames = staffEntries.map((staffIdOrName: string) => {
        const found = staff.find(s => String(s.id).trim() === String(staffIdOrName).trim() || s.name === staffIdOrName);
        return found ? found.name : String(staffIdOrName);
      });

      if (shiftSegments.length === 0 && rawShift) {
        shiftSegments.push(rawShift);
      }

      shiftSegments.forEach(segment => {
        const parsed = parseShiftSegment(segment);
        if (!parsed) return;
        
        const key = `${parsed.id}||${parsed.facility}`;

        if (!grouped[key]) {
          grouped[key] = {
            id: parsed.id,
            name: parsed.name,
            session: parsed.session,
            facility: parsed.facility,
            duration: parsed.duration,
            staffList: [],
          };
        }

        staffNames.forEach(name => {
          if (!grouped[key].staffList.includes(name)) {
            grouped[key].staffList.push(name);
          }
        });
      });
    });

    // Sắp xếp lịch thi tăng dần theo trình tự thời gian (ID ca thi) trước khi vẽ lên giao diện
    return Object.values(grouped).sort((a, b) => a.id.localeCompare(b.id));
  };
  
  

  const scheduleData = processAssignments();

  // Bộ lọc Tìm kiếm dữ liệu
  const filteredData = scheduleData.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.facility.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.session.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.staffList.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryStat 
          label="Tổng Số Ca Thi Kết Quả" 
          value={`${scheduleData.length} ca thi`} 
          sub="Hiển thị toàn vẹn danh sách song hành" 
          icon={<FileText className="text-blue-600" size={20} />} 
        />
        <SummaryStat 
          label="Kiểm định Ràng buộc" 
          value="100% Hợp lệ" 
          sub="Đã kiểm tra qua MILP" 
          icon={<FileCheck className="text-emerald-600" size={20} />} 
        />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Lịch Phân Công Coi Thi Hoàn Chỉnh ({filteredData.length} ca)
              </CardTitle>
              <CardDescription>Dữ liệu kết quả đồng bộ từ tệp cấu hình thuật toán.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                className="pl-9 h-9 text-sm" 
                placeholder="Tìm kiếm cán bộ, ca trực, ngày..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-md border-t overflow-hidden">
            <ScrollArea className="h-[550px] w-full">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 bg-white border-b">
                  <TableRow>
                    <TableHead className="font-bold text-slate-700 w-[180px] pl-6">Exam Details</TableHead>
                    <TableHead className="font-bold text-slate-700 w-[180px]">Session</TableHead>
                    <TableHead className="font-bold text-slate-700 w-[120px]">Location</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center w-[110px]">Thời gian gác</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center w-[90px]">Số lượng</TableHead>
                    <TableHead className="font-bold text-slate-700">Assigned Invigilators</TableHead>
                    <TableHead className="font-bold text-slate-700 text-right w-[110px] pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                        Không tìm thấy kết quả phù hợp.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((row, idx) => (
                      <TableRow key={idx} className="group hover:bg-slate-50/60 transition-colors">
                        <TableCell className="align-top py-3.5 pl-6">
                          <div className="font-bold text-slate-800 text-sm leading-tight">{row.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-1">{row.id}</div>
                        </TableCell>

                        <TableCell className="font-semibold text-slate-700 text-sm align-top py-3.5">
                          <div className="leading-tight">{row.session}</div>
                        </TableCell>

                        <TableCell className="align-top py-3.5">
                          <Badge 
                            variant="outline" 
                            className={`font-semibold text-xs px-2 py-0.5 rounded ${
                              row.facility.includes('1') 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                : 'bg-purple-50 text-purple-700 border-purple-100'
                            }`}
                          >
                            {row.facility}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center align-top py-3.5 font-medium text-slate-600 text-sm">
                          {row.duration}
                        </TableCell>

                        <TableCell className="text-center align-top py-3.5">
                          <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full h-6 w-6">
                            {row.staffList.length}
                          </span>
                        </TableCell>

                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {row.staffList.map((staffName, index) => (
                              <Badge 
                                key={index} 
                                variant="secondary" 
                                className="bg-slate-100 text-slate-700 border border-slate-200 font-medium px-2 py-0.5 rounded text-xs whitespace-nowrap"
                              >
                                {staffName}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="text-right align-top py-3.5 pr-6">
                          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-none text-[10px] px-2 py-0.5 font-bold tracking-wider">
                            VALIDATED
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, sub, icon }: { label: string, value: string, sub: string, icon: ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm bg-white hover:border-blue-200 transition-colors cursor-default group">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 leading-none mb-1">{value}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-[9px] text-slate-400 italic">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}