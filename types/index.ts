// types/index.ts
export interface User {
    id: string;
    email: string;
    name: string;
    photoURL?: string;
  }
  
  export interface AttendanceRecord {
    id: string;
    date: string; // YYYY-MM-DD format
    password: string;
    studentIds: string[];
  }
  
  export interface StudentAttendance {
    studentId: string;
    studentName: string;
    studentEmail: string;
    present: boolean;
  }