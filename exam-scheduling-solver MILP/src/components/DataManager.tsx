import { useState, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Calendar, MapPin, Upload, Download } from "lucide-react";
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area"; // Thêm ScrollArea
import type { Staff, Shift } from '@/lib/mock-data';
import { aggregateShifts, normalizeFacility } from '@/lib/shift-utils';

interface Facility {
  name: string;
  address: string;
  rooms: number;
  capacity: number;
}

interface DataManagerProps {
  staff: Staff[];
  shifts: Shift[];
  facilities?: Facility[];
  onUpdateStaff: (staff: Staff[]) => void;
  onUpdateShifts: (shifts: Shift[]) => void;
  onCsvUploaded?: (useOverrideCsv?: boolean) => void;
}

// Hàm bổ trợ bóc tách dòng CSV xử lý được dấu phẩy nằm trong ngoặc kép ""
function parseCSVLine(text: string): string[] {
  let insideQuote = false;
  let entries: string[] = [];
  let currentEntry = '';
  
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    let nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentEntry += '"';
        i++; 
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      entries.push(currentEntry.trim());
      currentEntry = '';
    } else {
      currentEntry += char;
    }
  }
  entries.push(currentEntry.trim());
  return entries;
}

export default function DataManager({ staff, shifts, facilities, onUpdateStaff, onUpdateShifts, onCsvUploaded }: DataManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null); // Thêm dòng này
// Hàm xử lý Import file CSV thực tế của người dùng (can_bo.csv và ca_thi.csv)
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const normalizedText = text.replace(/^\uFEFF/, '');
      const lines = normalizedText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length <= 1) {
        setStatusMessage("File CSV trống hoặc không có dòng dữ liệu.");
        return;
      }

      // Đọc dòng tiêu đề trước tiên
      const headers = parseCSVLine(lines[0]);
      
      // Kiểm tra xem đây là file cán bộ hay file ca thi dựa trên cấu trúc cột của bạn
          const normHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''));
      let isStaffFile = normHeaders.some(h => h.includes('macanbo') || h.includes('mscb') || h.includes('canbo') || h.includes('macb') || h.includes('gender') || h.includes('gioitinh') || h.includes('distcs1') || h.includes('distcs2') || h.includes('assignedcount'));
      let isShiftFile = normHeaders.some(h => h.includes('cathi') || h.includes('macathi') || h.includes('maca') || h.includes('shift') || h.includes('session') || h.includes('coso') || h.includes('facility') || h.includes('thoigian') || h.includes('date') || h.includes('dayofweek'));
      if (!isStaffFile && !isShiftFile) {
        isStaffFile = headers.length <= 6;
        isShiftFile = !isStaffFile;
      }

      if (isStaffFile && !isShiftFile) {
        // Xử lý file can_bo.csv (73 cán bộ)
        const parsedStaff: Staff[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (row.length < 5 || !row[0]) continue;

          // Chuẩn hóa giới tính bị lỗi font chữ 'N?' thành 'Nữ'
          let gender = row[1];
          if (gender === 'N?' || gender.includes('N') || gender.includes('n')) gender = 'Nữ';
          if (gender.includes('Nam')) gender = 'Nam';

          parsedStaff.push({
            id: row[0],
            name: `Cán bộ ${row[0]}`, // Tạo tên hiển thị đẹp từ Mã số cán bộ
            gender: gender,
            age: parseInt(row[2], 10) || 40,
            distCS1: parseFloat(row[3]) || 0,
            distCS2: parseFloat(row[4]) || 0,
            assignedCount: 0
          });
        }
        // Send raw CSV to server to store as can_bo_new.csv for backend runs
        try {
          await fetch('/api/upload-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'staff', filename: 'can_bo_new.csv', text })
          });
        } catch (e) {
          console.error('Upload CSV failed', e);
          setStatusMessage('Upload CSV lên server thất bại — vẫn cập nhật giao diện tạm thời.');
        }

        onUpdateStaff(parsedStaff);
        setStatusMessage(`Đã import thành công danh sách ${parsedStaff.length} Cán bộ coi thi.`);
        if (onCsvUploaded) onCsvUploaded(true);
      } 
      else if (isShiftFile) {
        // Xử lý file ca_thi.csv (80 ca thi)
        const parsedShifts: Shift[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (row.length < 8 || !row[5]) continue;

          const facility = normalizeFacility(row[6] ?? '');

          // Chuẩn hóa ngày thứ trong tuần
          let dayOfWeek = row[4];
          if (dayOfWeek.includes('2')) dayOfWeek = 'Thứ 2';
          if (dayOfWeek.includes('3')) dayOfWeek = 'Thứ 3';
          if (dayOfWeek.includes('4')) dayOfWeek = 'Thứ 4';
          if (dayOfWeek.includes('5')) dayOfWeek = 'Thứ 5';
          if (dayOfWeek.includes('6')) dayOfWeek = 'Thứ 6';
          if (dayOfWeek.includes('7')) dayOfWeek = 'Thứ 7';
          if (dayOfWeek.includes('ch') || dayOfWeek.includes('CN')) dayOfWeek = 'Chủ Nhật';

          parsedShifts.push({
            id: row[5], // Mã số ca thi làm ID duy nhất (ví dụ: 20260518_5)
            name: row[0], // Tên đầy đủ của ca thi
            date: row[1] ? row[1].split(' ')[0] : '', // Chỉ lấy phần ngày YYYY-MM-DD
            time: row[2], // Giờ thi (ví dụ: 18g15)
            dayOfWeek: dayOfWeek,
            facility: facility,
            staffRequired: parseInt(row[7], 10) || 2
          });
        }
        // Send raw CSV to server to store as ca_thi_new.csv for backend runs
        try {
          await fetch('/api/upload-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'shift', filename: 'ca_thi_new.csv', text })
          });
        } catch (e) {
          console.error('Upload CSV failed', e);
          setStatusMessage('Upload CSV lên server thất bại — vẫn cập nhật giao diện tạm thời.');
        }

        const mergedShifts = aggregateShifts(parsedShifts);
        onUpdateShifts(mergedShifts);
        const mergedNote =
          mergedShifts.length < parsedShifts.length
            ? ` (đã gộp ${parsedShifts.length - mergedShifts.length} dòng trùng mã ca + cơ sở)`
            : '';
        setStatusMessage(`Đã import thành công ${mergedShifts.length} Ca thi${mergedNote}.`);
        if (onCsvUploaded) onCsvUploaded(true);
      } else {
        setStatusMessage("Định dạng cột không phù hợp với cấu trúc file can_bo.csv hoặc ca_thi.csv.");
      }
    } catch (error) {
      setStatusMessage("Lỗi xử lý tệp CSV. Vui lòng kiểm tra lại cấu trúc.");
    }
  };

  // Tải file kết quả xuất từ backend
  const handleDownloadResults = async () => {
    try {
      setStatusMessage('Đang tải kết quả...');
      const resp = await fetch('/api/export', { method: 'POST' });
      if (!resp.ok) {
        setStatusMessage('Tải kết quả thất bại. Kiểm tra server.');
        return;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ket_Qua_Xep_Lich.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatusMessage('Tải kết quả hoàn tất.');
    } catch (e) {
      console.error('Download failed', e);
      setStatusMessage('Lỗi khi tải file kết quả.');
    }
  };

//   return (
//     <Card className="border-slate-200 shadow-sm">
//       <CardHeader className="flex flex-row items-center justify-between pb-4">
//         <div>
//           <CardTitle>Data Management</CardTitle>
//           <CardDescription>Review and prepare datasets before running the optimization engine.</CardDescription>
//         </div>
//         <div className="flex gap-2 items-center">
//             <input
//               type="file"
//               accept="application/json,.json"
//               ref={fileInputRef}
//               className="hidden"
//               onChange={async (event) => {
//                 const file = event.target.files?.[0];
//                 if (!file) return;

//                 try {
//                   const text = await file.text();
//                   let payload: any = null;

//                   try {
//                     payload = JSON.parse(text);
//                   } catch {
//                     payload = null;
//                   }

//                   if (!payload) {
//                     setStatusMessage('Unable to parse dataset file. Please upload valid JSON with staff and shifts.');
//                     return;
//                   }

//                   if (Array.isArray(payload)) {
//                     const first = payload[0] || {};
//                     if (first?.gender || first?.distCS1 !== undefined) {
//                       onUpdateStaff(payload as Staff[]);
//                       setStatusMessage(`Imported ${payload.length} staff records.`);
//                     } else if (first?.time || first?.dayOfWeek) {
//                       onUpdateShifts(payload as Shift[]);
//                       setStatusMessage(`Imported ${payload.length} shift records.`);
//                     } else {
//                       setStatusMessage('JSON array could not be classified as staff or shifts.');
//                     }
//                     return;
//                   }

//                   if (payload.staff || payload.shifts) {
//                     if (Array.isArray(payload.staff)) {
//                       onUpdateStaff(payload.staff);
//                     }
//                     if (Array.isArray(payload.shifts)) {
//                       onUpdateShifts(payload.shifts);
//                     }
//                     const importedParts = [payload.staff ? 'staff' : null, payload.shifts ? 'shifts' : null].filter(Boolean).join(' and ');
//                     setStatusMessage(`Imported ${importedParts} from dataset.`);
//                     return;
//                   }

//                   setStatusMessage('Dataset file missing required staff or shifts arrays.');
//                 } catch (error) {
//                   setStatusMessage('Upload failed. Confirm the file format and try again.');
//                 }
//               }}
//             />
//             <Button
//               variant="outline"
//               size="sm"
//               className="gap-2"
//               onClick={() => fileInputRef.current?.click()}
//             >
//               <Upload size={14}/> Upload Dataset
//             </Button>
//             {statusMessage && (
//               <span className="text-xs text-slate-500 italic">{statusMessage}</span>
//             )}
//         </div>
//       </CardHeader>
//       <CardContent>
//         <Tabs defaultValue="staff" className="space-y-4">
//           <div className="flex flex-col sm:flex-row justify-between gap-4">
//             <TabsList className="bg-slate-100 p-1">
//               <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-white">
//                 <Users size={14} /> Staff List
//               </TabsTrigger>
//               <TabsTrigger value="shifts" className="gap-2 data-[state=active]:bg-white">
//                 <Calendar size={14} /> Exam Shifts
//               </TabsTrigger>
//               <TabsTrigger value="facilities" className="gap-2 data-[state=active]:bg-white">
//                 <MapPin size={14} /> Facilities
//               </TabsTrigger>
//             </TabsList>
            
//             <div className="relative w-full sm:w-64">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
//               <Input 
//                 className="pl-9 h-9" 
//                 placeholder="Search resources..." 
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//               />
//             </div>
//           </div>

//           <TabsContent value="staff">
//             <div className="rounded-md border">
//               <Table>
//                 <TableHeader className="bg-slate-50/50">
//                   <TableRow>
//                     <TableHead className="w-24">MS_CB</TableHead>
//                     <TableHead>Full Name</TableHead>
//                     <TableHead>Gender</TableHead>
//                     <TableHead>Age</TableHead>
//                     <TableHead>Dist (CS1)</TableHead>
//                     <TableHead>Dist (CS2)</TableHead>
//                     <TableHead className="text-right">Status</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {staff.map((staffMember) => (
//                     <TableRow key={staffMember.id} className="hover:bg-slate-50/50 transition-colors">
//                       <TableCell className="font-mono text-xs font-semibold">{staffMember.id}</TableCell>
//                       <TableCell className="font-medium">{staffMember.name}</TableCell>
//                       <TableCell>
//                         <Badge variant="secondary" className="font-normal">
//                           {staffMember.gender}
//                         </Badge>
//                       </TableCell>
//                       <TableCell>{staffMember.age}</TableCell>
//                       <TableCell className="text-slate-500">{staffMember.distCS1} km</TableCell>
//                       <TableCell className="text-slate-500">{staffMember.distCS2} km</TableCell>
//                       <TableCell className="text-right">
//                         <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shadow-none border-green-200">
//                           Verified
//                         </Badge>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>

//           <TabsContent value="shifts">
//             <div className="rounded-md border">
//               <Table>
//                 <TableHeader className="bg-slate-50/50">
//                   <TableRow>
//                     <TableHead className="w-32">Unique ID</TableHead>
//                     <TableHead>Facility</TableHead>
//                     <TableHead>Date</TableHead>
//                     <TableHead>Shift Time</TableHead>
//                     <TableHead>Day</TableHead>
//                     <TableHead className="text-right">Required</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {shifts.map((shift) => (
//                     <TableRow key={shift.id}>
//                       <TableCell className="font-mono text-xs font-semibold">{shift.id}</TableCell>
//                       <TableCell>
//                         <Badge variant="outline" className="font-medium bg-blue-50 text-blue-700 border-blue-100 italic">
//                           {shift.facility}
//                         </Badge>
//                       </TableCell>
//                       <TableCell>{shift.date}</TableCell>
//                       <TableCell className="font-medium">{shift.time}</TableCell>
//                       <TableCell>{shift.dayOfWeek}</TableCell>
//                       <TableCell className="text-right font-bold text-blue-600">{shift.staffRequired}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>

//           <TabsContent value="facilities">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {(facilities ?? []).map((facility) => (
//                 <Card key={facility.name} className="bg-white border-slate-200 overflow-hidden group hover:border-blue-300 transition-colors">
//                   <CardHeader className="pb-2 space-y-0">
//                      <div className="flex items-center justify-between">
//                         <Badge className="bg-blue-600 mb-2">{facility.name}</Badge>
//                         <MapPin size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
//                      </div>
//                      <CardTitle className="text-sm">{facility.address}</CardTitle>
//                   </CardHeader>
//                   <CardContent className="pt-2">
//                     <div className="grid grid-cols-2 gap-4 text-xs">
//                         <div className="space-y-1">
//                             <span className="text-slate-400 block font-bold uppercase tracking-widest text-[9px]">Rooms</span>
//                             <span className="text-xl font-bold text-slate-800">{facility.rooms}</span>
//                         </div>
//                         <div className="space-y-1">
//                             <span className="text-slate-400 block font-bold uppercase tracking-widest text-[9px]">Capacity</span>
//                             <span className="text-xl font-bold text-slate-800">{facility.capacity}</span>
//                         </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//               ))}
//             </div>
//           </TabsContent>
//         </Tabs>
//       </CardContent>
//     </Card>
//   );
// }



// Định nghĩa lại bộ lọc tìm kiếm chính xác theo dữ liệu từ file CSV của bạn
  const filteredStaff = staff.filter(s => 
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.gender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShifts = shifts.filter(s => 
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.facility.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.dayOfWeek.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Review and prepare datasets before running the optimization engine.</CardDescription>
        </div>
        <div className="flex gap-2 items-center">
            {/* Input upload cấu hình JSON - Đã nâng cấp câu thông báo lỗi (Yêu cầu 2) */}
            <input
              type="file"
              accept="application/json,.json"
              ref={fileInputRef}
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  let payload = null;
                  try { payload = JSON.parse(text); } catch { payload = null; }

                  if (!payload) {
                    setStatusMessage('Invalid file structure. Accepted formats: .json containing {"staff": [], "shifts": []} layout or valid array schema.');
                    return;
                  }

                  if (Array.isArray(payload)) {
                    const first = payload[0] || {};
                    if (first?.gender || first?.distCS1 !== undefined) {
                      onUpdateStaff(payload as Staff[]);
                      setStatusMessage(`Imported ${payload.length} staff records.`);
                    } else if (first?.time || first?.dayOfWeek) {
                      onUpdateShifts(payload as Shift[]);
                      setStatusMessage(`Imported ${payload.length} shift records.`);
                    }
                    return;
                  }

                  if (payload.staff || payload.shifts) {
                    if (Array.isArray(payload.staff)) onUpdateStaff(payload.staff);
                    if (Array.isArray(payload.shifts)) onUpdateShifts(payload.shifts);
                    setStatusMessage('Dataset JSON fields loaded completely.');
                    return;
                  }
                  setStatusMessage('JSON template structure unrecognized.');
                } catch {
                  setStatusMessage('Upload failed. Check file content encoding.');
                }
              }}
            />

            {/* Input ẩn phục vụ cho việc Import file CSV (Cán bộ / Ca thi) */}
            <input 
              type="file"
              accept=".csv"
              ref={csvInputRef}
              className="hidden"
              onChange={handleImportCSV}
              onClick={(e) => { (e.target as any).value = null; }}
            />

            {/* Nút bấm thực hiện Import CSV từ file của bạn (Yêu cầu 1) */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload size={14} className="text-emerald-600"/> Import CSV (Cán bộ / Ca thi)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 ml-2"
              onClick={handleDownloadResults}
            >
              <Download size={14} className="text-slate-600"/> Download Results
            </Button>
            {statusMessage && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 italic max-w-xs truncate" title={statusMessage}>
                {statusMessage}
              </span>
            )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="staff" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-white">
                <Users size={14} /> Staff List ({filteredStaff.length})
              </TabsTrigger>
              <TabsTrigger value="shifts" className="gap-2 data-[state=active]:bg-white">
                <Calendar size={14} /> Exam Shifts ({filteredShifts.length})
              </TabsTrigger>
              <TabsTrigger value="facilities" className="gap-2 data-[state=active]:bg-white">
                <MapPin size={14} /> Facilities
              </TabsTrigger>
            </TabsList>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                className="pl-9 h-9" 
                placeholder="Search resources..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tab hiển thị Danh sách Cán bộ */}
          <TabsContent value="staff">
            <div className="rounded-md border overflow-hidden">
              <ScrollArea className="h-[420px] w-full">
                <Table>
                  <TableHeader className="bg-slate-50/50 sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      <TableHead className="w-24">MS_CB</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Dist (CS1)</TableHead>
                      <TableHead>Dist (CS2)</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-slate-400 italic">
                          No staff found. Please import can_bo.csv
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((staffMember) => (
                        <TableRow key={staffMember.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold">{staffMember.id}</TableCell>
                          <TableCell className="font-medium">{staffMember.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {staffMember.gender}
                            </Badge>
                          </TableCell>
                          <TableCell>{staffMember.age}</TableCell>
                          <TableCell className="text-slate-500">{staffMember.distCS1} km</TableCell>
                          <TableCell className="text-slate-500">{staffMember.distCS2} km</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shadow-none border-green-200">
                              Verified
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Tab hiển thị Ca Thi - Đã bọc ScrollArea để hiển thị mượt mà 80 ca thi (Yêu cầu 1) */}
          <TabsContent value="shifts">
            <div className="rounded-md border overflow-hidden">
              <ScrollArea className="h-[450px] w-full">
                <Table>
                  <TableHeader className="bg-slate-50/50 sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      <TableHead className="w-32">Unique ID</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Shift Time</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShifts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-slate-400 italic">
                          No shifts found. Please import ca_thi.csv
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredShifts.map((shift) => (
                        <TableRow key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold">{shift.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium bg-blue-50 text-blue-700 border-blue-100 italic">
                              {shift.facility}
                            </Badge>
                          </TableCell>
                          <TableCell>{shift.date}</TableCell>
                          <TableCell className="font-medium">{shift.time}</TableCell>
                          <TableCell>{shift.dayOfWeek}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600 pr-6">{shift.staffRequired}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Tab hiển thị Cơ sở */}
          <TabsContent value="facilities">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(facilities ?? []).map((facility) => (
                <Card key={facility.name} className="bg-white border-slate-200 overflow-hidden group hover:border-blue-300 transition-colors">
                  <CardHeader className="pb-2 space-y-0">
                     <div className="flex items-center justify-between">
                        <Badge className="bg-blue-600 mb-2">{facility.name}</Badge>
                        <MapPin size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                     </div>
                     <CardTitle className="text-sm">{facility.address}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase tracking-widest text-[9px]">Rooms</span>
                            <span className="text-xl font-bold text-slate-800">{facility.rooms}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase tracking-widest text-[9px]">Capacity</span>
                            <span className="text-xl font-bold text-slate-800">{facility.capacity}</span>
                        </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}