import AuthPage from "@/components/Auth/AuthPage"

type Role = 'teacher' | 'student'

const StudentLogin = () => <AuthPage role={'student' as Role} nonlyLogin={true} />


export default StudentLogin
