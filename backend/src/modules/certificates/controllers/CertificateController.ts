import {inject, injectable} from 'inversify';
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Param,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {CERTIFICATE_TYPES} from '../types.js';
import {CertificateService} from '../services/CertificateService.js';
import {CertificateResponse} from '../classes/index.js';
import {AuthenticatedUser} from '#root/shared/index.js';

@OpenAPI({
  tags: ['Certificates'],
  description: 'Issuance and verification of course completion certificates',
})
@injectable()
@JsonController('/certificates')
class CertificateController {
  constructor(
    @inject(CERTIFICATE_TYPES.CertificateService)
    private readonly certificateService: CertificateService,
  ) {}

  // NOTE: /mine (static) is declared before /:certificateId (wildcard)
  // deliberately — routing-controllers registers routes in method
  // declaration order, and a wildcard route registered first will match
  // "mine" as a certificateId value, shadowing the static route entirely.
  @OpenAPI({
    summary: "Get the current user's certificates",
    description: 'Returns every certificate issued to the logged-in student.',
  })
  @Authorized()
  @ResponseSchema(CertificateResponse, {isArray: true})
  @Get('/mine')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificateResponse[]> {
    return this.certificateService.getAllForUser(user.userId);
  }

  @OpenAPI({
    summary: 'Verify a certificate',
    description:
      'Public endpoint — no auth required. Anyone with a certificate link ' +
      'can confirm it is genuine, the same way a paper certificate is ' +
      'checkable without logging in.',
  })
  @ResponseSchema(CertificateResponse)
  @Get('/:certificateId')
  async verify(
    // Deliberately a single primitive @Param(), not a @Params() DTO class.
    // routing-controllers' normalizeParamValue treats any non-primitive
    // (class) target type as something that may need JSON.parse-ing —
    // fine for @Body(), but @Params()/@Param() values from the URL are
    // already plain strings/objects, never JSON-encoded, so that path
    // throws a ParamNormalizationError here. A primitive-typed @Param()
    // skips that code path entirely.
    @Param('certificateId') certificateId: string,
  ): Promise<CertificateResponse> {
    return this.certificateService.getByCertificateId(certificateId);
  }
}

export {CertificateController};
