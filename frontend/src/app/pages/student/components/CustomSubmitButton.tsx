export function CustomSubmitButton() {

  return (
    <div className="flex justify-start ml-1 mt-4 relative z-10">
      <button
        type="submit"
        className="bg-amber-400 hover:bg-amber-500
                    hover:cursor-pointer
                   text-black  px-4 py-2 rounded-md
                   shadow-gray-300 shadow-sm"
      >
        Submit
      </button>
    </div>
  );
}
