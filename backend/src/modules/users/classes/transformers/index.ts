import {Expose, Type} from 'class-transformer';
import {Enrollment} from './Enrollment';
import {Progress} from './Progress';
import {Token} from 'typedi';

export * from './Enrollment';
export * from './Progress';

@Expose({toPlainOnly: true})
export class EnrollUserResponse {
  @Expose()
  @Type(() => Enrollment)
  enrollment: Enrollment;

  @Expose()
  @Type(() => Progress)
  progress: Progress;

  constructor(enrollment: Enrollment, progress: Progress) {
    this.enrollment = enrollment;
    this.progress = progress;
  }
}
