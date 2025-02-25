export const upload = (id: number, len: number): string => {
  console.log('uploaded ids ', id - len, ' to ', id)
  return 'success'
}
