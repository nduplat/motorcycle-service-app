import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
/// <reference types="jasmine" />

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let activatedRouteSpy: jasmine.SpyObj<ActivatedRoute>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login', 'signInWithGoogle', 'signInWithApple', 'waitForUser'], {
      currentUser: jasmine.createSpy().and.returnValue(null)
    });
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['initializeAudio', 'requestPermission']);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);
    const activatedRouteSpyObj = jasmine.createSpyObj('ActivatedRoute', [], {
      snapshot: { queryParams: {} }
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: Router, useValue: routerSpyObj },
        { provide: ActivatedRoute, useValue: activatedRouteSpyObj }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    notificationServiceSpy = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    activatedRouteSpy = TestBed.inject(ActivatedRoute) as jasmine.SpyObj<ActivatedRoute>;
  });

  it('should create', () => {
    expect(component).to.be.true;
  });

  it('should initialize form with required validators', () => {
    expect(component.loginForm.get('email')?.validator).to.be.true;
    expect(component.loginForm.get('password')?.validator).to.be.true;
  });

  it('should set accessDenied on init when access=denied', () => {
    activatedRouteSpy.snapshot.queryParams = { access: 'denied' };
    component.ngOnInit();
    expect(component.accessDenied()).to.contain('No tienes permisos');
  });

  it('should call authService.login on email sign in', async () => {
    component.loginForm.setValue({ email: 'test@example.com', password: 'password' });
    authServiceSpy.login.and.returnValue(Promise.resolve(true));
    authServiceSpy.waitForUser.and.returnValue(Promise.resolve({
      id: '1',
      uid: 'firebase-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      name: 'Test',
      role: 'customer',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await component.onEmailSignIn();

    expect(authServiceSpy.login).to.have.been.calledWith('test@example.com', 'password');
  });

  it('should set error on invalid form', async () => {
    component.loginForm.setValue({ email: '', password: '' });

    await component.onEmailSignIn();

    expect(component.error()).to.contain('ingresa un email y contraseña válidos');
  });

  it('should navigate after successful login', async () => {
    component.loginForm.setValue({ email: 'test@example.com', password: 'password' });
    authServiceSpy.login.and.returnValue(Promise.resolve(true));
    authServiceSpy.waitForUser.and.returnValue(Promise.resolve({
      id: '1',
      uid: 'firebase-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      name: 'Test',
      role: 'customer',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    authServiceSpy.currentUser.and.returnValue({
      id: '1',
      uid: 'firebase-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      name: 'Test',
      role: 'customer',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await component.onEmailSignIn();

    expect(routerSpy.navigate).to.have.been.calledWith(['/']);
  });

  it('should call signInWithGoogle', async () => {
    authServiceSpy.signInWithGoogle.and.returnValue(Promise.resolve(true));
    authServiceSpy.waitForUser.and.returnValue(Promise.resolve({
      id: '1',
      uid: 'firebase-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      name: 'Test',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await component.onGoogleSignIn();

    expect(authServiceSpy.signInWithGoogle).to.have.been.called;
  });

  it('should call signInWithApple', async () => {
    authServiceSpy.signInWithApple.and.returnValue(Promise.resolve(true));
    authServiceSpy.waitForUser.and.returnValue(Promise.resolve({
      id: '1',
      uid: 'firebase-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      name: 'Test',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await component.onAppleSignIn();

    expect(authServiceSpy.signInWithApple).to.have.been.called;
  });
});