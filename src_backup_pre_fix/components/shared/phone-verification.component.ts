import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, AuthError } from 'firebase/auth';
import { auth } from '../../firebase.config';

export interface PhoneVerificationResult {
  success: boolean;
  phoneNumber: string;
  error?: string;
}

@Component({
  selector: 'app-phone-verification',
  templateUrl: './phone-verification.component.html',
  styleUrls: ['./phone-verification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule],
})
export class PhoneVerificationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);

  @Input() flow: 'registration' | 'login' = 'registration';
  @Input() initialPhoneNumber = '';

  @Output() verificationSuccess = new EventEmitter<PhoneVerificationResult>();
  @Output() verificationFailure = new EventEmitter<PhoneVerificationResult>();

  // State management
  isLoading = signal(false);
  error = signal<string | null>(null);
  otpSent = signal(false);
  countdown = signal(0);
  confirmationResult: ConfirmationResult | null = null;

  // Forms
  phoneForm = this.fb.group({
    phone: ['', [
      Validators.required,
      this.colombianPhoneValidator()
    ]]
  });

  otpForm = this.fb.group({
    digit1: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    digit2: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    digit3: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    digit4: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    digit5: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    digit6: ['', [Validators.required, Validators.pattern(/^\d$/)]]
  });

  private countdownInterval: any;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  ngOnInit() {
    if (this.initialPhoneNumber) {
      this.phoneForm.patchValue({ phone: this.initialPhoneNumber });
    }
    this.initializeRecaptcha();
  }

  ngOnDestroy() {
    this.clearCountdown();
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
    }
  }

  private initializeRecaptcha() {
    // Initialize reCAPTCHA verifier for phone authentication
    this.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        this.error.set('reCAPTCHA expiró. Intente nuevamente.');
      }
    });
  }

  private colombianPhoneValidator() {
    return (control: AbstractControl): { [key: string]: any } | null => {
      if (!control.value) return null;

      // Remove all non-digit characters
      const cleanNumber = control.value.replace(/\D/g, '');

      // Colombian phone number patterns:
      // +57 3xx xxx xxxx (10 digits after +57)
      // 57 3xx xxx xxxx
      // 3xx xxx xxxx (10 digits starting with 3,4, or 5)

      const colombianPhoneRegex = /^(\+57|57)?[3-5]\d{8}$/;

      if (!colombianPhoneRegex.test(control.value)) {
        return { invalidColombianPhone: true };
      }

      return null;
    };
  }

  formatPhoneNumber(phone: string): string {
    // Format to +57 3xx xxx xxxx
    const cleanNumber = phone.replace(/\D/g, '');

    if (cleanNumber.startsWith('57')) {
      const withoutCountry = cleanNumber.slice(2);
      return `+57 ${withoutCountry.slice(0, 3)} ${withoutCountry.slice(3, 6)} ${withoutCountry.slice(6)}`;
    } else if (cleanNumber.length === 10) {
      return `+57 ${cleanNumber.slice(0, 3)} ${cleanNumber.slice(3, 6)} ${cleanNumber.slice(6)}`;
    }

    return phone;
  }

  async sendOTP() {
    if (this.phoneForm.invalid) {
      this.phoneForm.get('phone')?.markAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const phoneNumber = this.formatPhoneNumber(this.phoneForm.value.phone!);

      if (!this.recaptchaVerifier) {
        throw new Error('reCAPTCHA no inicializado');
      }

      // Send OTP via Firebase Auth
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        this.recaptchaVerifier
      );

      this.otpSent.set(true);
      this.startCountdown();
      this.error.set(null);

    } catch (error: any) {
      console.error('Error sending OTP:', error);
      this.handleAuthError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async verifyOTP() {
    if (this.otpForm.invalid) {
      Object.keys(this.otpForm.controls).forEach(key => {
        this.otpForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const otp = Object.values(this.otpForm.value).join('');

      if (!this.confirmationResult) {
        throw new Error('No hay resultado de confirmación disponible');
      }

      // Verify OTP
      const result = await this.confirmationResult.confirm(otp);

      // Success
      const phoneNumber = this.formatPhoneNumber(this.phoneForm.value.phone!);
      this.verificationSuccess.emit({
        success: true,
        phoneNumber
      });

    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      this.handleAuthError(error);
      this.verificationFailure.emit({
        success: false,
        phoneNumber: this.formatPhoneNumber(this.phoneForm.value.phone!),
        error: error.message
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: AuthError) {
    switch (error.code) {
      case 'auth/invalid-phone-number':
        this.error.set('Número de teléfono inválido');
        break;
      case 'auth/missing-phone-number':
        this.error.set('Número de teléfono requerido');
        break;
      case 'auth/too-many-requests':
        this.error.set('Demasiados intentos. Intente más tarde');
        break;
      case 'auth/invalid-verification-code':
        this.error.set('Código de verificación inválido');
        break;
      case 'auth/code-expired':
        this.error.set('Código de verificación expirado');
        break;
      case 'auth/invalid-verification-id':
        this.error.set('ID de verificación inválido');
        break;
      default:
        this.error.set('Error de verificación: ' + error.message);
    }
  }

  private startCountdown() {
    this.countdown.set(60); // 60 seconds countdown
    this.clearCountdown();

    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current > 0) {
        this.countdown.set(current - 1);
      } else {
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  canResendOTP(): boolean {
    return this.countdown() === 0 && !this.isLoading();
  }

  resendOTP() {
    if (!this.canResendOTP()) return;
    this.otpSent.set(false);
    this.sendOTP();
  }

  onOtpInput(event: Event, nextInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Only allow digits
    if (!/^\d$/.test(value) && value !== '') {
      input.value = '';
      return;
    }

    // Auto-focus next input
    if (value && nextInput) {
      nextInput.focus();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, prevInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !input.value && prevInput) {
      prevInput.focus();
    }
  }

  reset() {
    this.otpSent.set(false);
    this.error.set(null);
    this.clearCountdown();
    this.countdown.set(0);
    this.phoneForm.reset();
    this.otpForm.reset();
    this.confirmationResult = null;
  }
}