import AuthPage from "@/components/Auth/AuthPage"

type Role = 'teacher' | 'student'

const TeacherLogin = () => <AuthPage role={'teacher' as Role} />

export default TeacherLogin
