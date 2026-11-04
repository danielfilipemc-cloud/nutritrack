import type {StudentArea} from './DemoStudentPortal';

const paths:Record<StudentArea,string>={
 today:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
 training:'m6 3-3 3m18 12-3 3M4 8l4-4 12 12-4 4L4 8Zm4 4 4-4m0 8 4-4',
 nutrition:'M12 8c-2-4-8-3-8 3 0 5 3 10 6 10 1 0 1-1 2-1s1 1 2 1c3 0 6-5 6-10 0-6-6-7-8-3Zm0 0c0-4 2-6 5-6',
 agenda:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-3v6m10-6v6M3 11h18M7 15h3m4 0h3',
 evolution:'M4 3v17h17M7 15l4-5 4 3 6-8m-5 0h5v5',
};
export default function StudentAreaIcon({area}:{area:StudentArea}){return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[area]}/></svg>;}
