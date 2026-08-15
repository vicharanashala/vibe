import { JsonController, Get, Post, Put, Delete, Body, Param, Authorized, CurrentUser, HttpError } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { VIBECODE_TYPES } from '../types.js';
import { CodeExecutionService } from '../services/CodeExecutionService.js';
import { CodingProblemRepository } from '../repositories/providers/mongodb/CodingProblemRepository.js';
import { CodingSubmissionRepository } from '../repositories/providers/mongodb/CodingSubmissionRepository.js';
import { CodingProblem } from '../interfaces/CodingProblem.js';

@JsonController('/vibecode')
@injectable()
export class CodeExecutionController {
  constructor(
    @inject(VIBECODE_TYPES.CodeExecutionService)
    private executionService: CodeExecutionService,
    @inject(VIBECODE_TYPES.CodingProblemRepo)
    private problemRepo: CodingProblemRepository,
    @inject(VIBECODE_TYPES.CodingSubmissionRepo)
    private submissionRepo: CodingSubmissionRepository,
  ) {}

  @Get('/problems')
  @Authorized()
  async getProblems() {
    const problems = await this.problemRepo.getAll();
    // Strip hidden test cases before sending to client
    return problems.map(p => ({
      ...p,
      _id: p._id?.toString(),
      testCases: (p.testCases || []).filter(tc => !tc.isHidden)
    }));
  }

  @Get('/problems/:id')
  @Authorized()
  async getProblem(@Param('id') id: string) {
    const problem = await this.problemRepo.getById(id);
    if (!problem) throw new HttpError(404, 'Problem not found');
    
    const safeProblem = {
      ...problem,
      _id: problem._id?.toString(),
      testCases: (problem.testCases || []).filter(tc => !tc.isHidden)
    };
    return safeProblem;
  }

  @Post('/problems')
  @Authorized()
  async createProblem(@Body() problem: CodingProblem) {
    return this.problemRepo.create(problem);
  }

  @Put('/problems/:id')
  @Authorized()
  async updateProblem(@Param('id') id: string, @Body() problem: Partial<CodingProblem>) {
    const success = await this.problemRepo.update(id, problem);
    if (!success) throw new HttpError(404, 'Problem not found or could not be updated');
    return { success: true };
  }

  @Delete('/problems/:id')
  @Authorized()
  async deleteProblem(@Param('id') id: string) {
    const success = await this.problemRepo.delete(id);
    if (!success) throw new HttpError(404, 'Problem not found or could not be deleted');
    return { success: true };
  }

  @Post('/submit')
  @Authorized()
  async submitCode(
    @CurrentUser({ required: true }) user: any,
    @Body() body: { problemId: string; language: string; code: string; isRun?: boolean }
  ) {
    if (!body.problemId || !body.language || !body.code) {
      throw new HttpError(400, 'Missing required fields');
    }
    
    return this.executionService.executeCode(
      body.problemId,
      user.firebaseUID, // Firebase user ID
      body.language,
      body.code,
      !!body.isRun
    );
  }

  @Get('/submissions/solved')
  @Authorized()
  async getSolvedProblems(
    @CurrentUser({ required: true }) user: any
  ) {
    return this.submissionRepo.getSolvedProblemIds(user.firebaseUID);
  }

  @Get('/submissions/:problemId')
  @Authorized()
  async getMySubmissions(
    @CurrentUser({ required: true }) user: any,
    @Param('problemId') problemId: string
  ) {
    return this.submissionRepo.getByStudentAndProblem(user.firebaseUID, problemId);
  }

  @Get('/teacher/submissions')
  @Authorized() // In a real app, restrict to @Authorized(['teacher'])
  async getTeacherSubmissions() {
    return this.submissionRepo.getAllWithDetails();
  }

  @Get('/teacher/problems')
  @Authorized()
  async getTeacherProblems() {
    // Teachers get all problems without stripping hidden test cases
    const problems = await this.problemRepo.getAll();
    return problems.map(p => ({
      ...p,
      _id: p._id?.toString()
    }));
  }
}
