'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchAllStudentsProgress } from '@/store/slices/AllStudentsProgressSlice'
import { useDispatch, useSelector } from 'react-redux'

// const data: Progress[] = [
//   {
//     studentId: 'EB9lxn1eH3YSowFuCEbrODm9wiq2',
//     firebaseUid: 'EB9lxn1eH3YSowFuCEbrODm9wiq2',
//     email: '2021meb1265@iitrpr.ac.in',
//     firstName: 'AKSHAT',
//     lastName: 'CHOUHAN',
//     averageProgress: 1,
//   },
//   {
//     studentId: 'WRUgtmCFcDU1Xw79pvNW4Dya52K3',
//     firebaseUid: 'WRUgtmCFcDU1Xw79pvNW4Dya52K3',
//     email: '2024eeb1175@iitrpr.ac.in',
//     firstName: 'AASHI',
//     lastName: 'VERMA',
//     averageProgress: 7,
//   },
// ]

export type Progress = {
  studentId: string
  averageProgress: number
  email: string
  firstName: string
  lastName: string
  firebaseUid: string
  rank: number
}

export const columns: ColumnDef<Progress>[] = [
  {
    accessorKey: 'rank',
    header: 'rank',
    cell: ({ row }) => <div className='capitalize'>{row.getValue('rank')}</div>,
  },
  {
    accessorKey: 'firstName',
    header: 'firstName',
    cell: ({ row }) => (
      <div className='capitalize'>{row.getValue('firstName')}</div>
    ),
  },

  {
    accessorKey: 'lastName',
    header: () => <div className=''>Last Name</div>,
    cell: ({ row }) => {
      const name = row.getValue('lastName')

      // Format the amount as a dollar amount

      return <div className=''>{name}</div>
    },
  },
  {
    accessorKey: 'averageProgress',
    header: ({ column }) => {
      return (
        <Button
          className='m-0 p-0'
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Progress
          <ArrowUpDown />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className='lowercase'>{row.getValue('averageProgress')} %</div>
    ),
  },
]

export function DataTableDemo() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [pageSize, setPageSize] = React.useState(7) // Initial page size set to 7 rows per page
  const [pageIndex, setPageIndex] = React.useState(0) // Initial page index

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const dispatch = useDispatch()
  const studentsProgress = useSelector(
    (state) => state.studentsProgress?.AllstudentsProgress ?? []
  )
  const [sortedAndRankedData, setSortedAndRankedData] = React.useState([])

  console.log('studentsProgress:', studentsProgress)

  React.useEffect(() => {
    if (studentsProgress === undefined || studentsProgress?.length === 0) {
      dispatch(fetchAllStudentsProgress())
    }
  }, [dispatch, studentsProgress.length])

  console.log('studentsProgress2 :', studentsProgress)

  //   const { studentsProgress, isLoading, error } = useSelector(
  //     (state) => state.studentProgress?.AllstudentsProgress ?? []
  //   )
  //   console.log('studentsProgress:', studentsProgress)

  //   React.useEffect(() => {
  //     if (studentsProgress === undefined) {
  //       dispatch(fetchAllStudentsProgress())
  //     }
  //   }, [dispatch, studentsProgress])

  React.useEffect(() => {
    if (studentsProgress.length > 0) {
      // Sort the data by averageProgress in descending order
      const sortedData = [...studentsProgress].sort(
        (a, b) => b.averageProgress - a.averageProgress
      )

      // Create a new array with ranks added
      const rankedData = []
      let previousProgress = null
      let rank = 0
      let usersAtThisRank = 0

      sortedData.forEach((student, index) => {
        if (student.averageProgress !== previousProgress) {
          // Increment rank to the next number of users, plus one to start from 1
          rank += usersAtThisRank
          usersAtThisRank = 1 // reset users at this rank
        } else {
          // If the same as previous, do not change the rank, increment count
          usersAtThisRank++
        }

        // Assign rank and update previousProgress
        rankedData.push({ ...student, rank: rank + 1 })
        previousProgress = student.averageProgress
      })

      setSortedAndRankedData(rankedData)
    }
  }, [studentsProgress])

  const handleNextPage = () => {
    if (table.getCanNextPage()) {
      setPageIndex((current) => current + 1)
    }
  }

  const handlePreviousPage = () => {
    if (table.getCanPreviousPage()) {
      setPageIndex((current) => current - 1)
    }
  }

  const table = useReactTable({
    data: sortedAndRankedData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false, // set to true if you are fetching data server-side
    pageCount: undefined, // provide total page count if using server-side pagination
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex, pageSize }, // Add pagination state here
    },
  })

  return (
    <div className='w-full'>
      <div className='flex items-center py-4'>
        <Input
          placeholder='Filter name...'
          value={
            (table.getColumn('firstName')?.getFilterValue() as string) ?? ''
          }
          onChange={(event) =>
            table.getColumn('firstName')?.setFilterValue(event.target.value)
          }
          className='max-w-sm'
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' className='ml-auto'>
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className='capitalize'
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className=''>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-right'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-end space-x-2 py-4'>
        <div className='flex-1 text-sm text-muted-foreground'>
          7 of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className='space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handlePreviousPage}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleNextPage}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
