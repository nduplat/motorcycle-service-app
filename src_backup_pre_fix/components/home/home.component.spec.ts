import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { HomeComponent } from './home.component';
import { ProductService } from '../../services/product.service';
import { ServiceItemService } from '../../services/service-item.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let productServiceSpy: jasmine.SpyObj<ProductService>;
  let serviceItemServiceSpy: jasmine.SpyObj<ServiceItemService>;

  beforeEach(async () => {
    const productSpy = jasmine.createSpyObj('ProductService', [], {
      getProducts: jasmine.createSpy().and.returnValue(signal([]))
    });
    const serviceSpy = jasmine.createSpyObj('ServiceItemService', [], {
      getServices: jasmine.createSpy().and.returnValue(signal([]))
    });

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: ProductService, useValue: productSpy },
        { provide: ServiceItemService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    productServiceSpy = productSpy as jasmine.SpyObj<ProductService>;
    serviceItemServiceSpy = serviceSpy as jasmine.SpyObj<ServiceItemService>;
  });

  it('should create', () => {
    expect(component).to.be.true;
  });

  it('should compute featuredProducts', () => {
    const products = [
      { id: '1', name: 'Product 1', price: 100, stock: 10, compatibleBrands: [], compatibleModels: [] },
      { id: '2', name: 'Product 2', price: 200, stock: 20, compatibleBrands: [], compatibleModels: [] },
      { id: '3', name: 'Product 3', price: 300, stock: 30, compatibleBrands: [], compatibleModels: [] },
      { id: '4', name: 'Product 4', price: 400, stock: 40, compatibleBrands: [], compatibleModels: [] },
      { id: '5', name: 'Product 5', price: 500, stock: 50, compatibleBrands: [], compatibleModels: [] }
    ];
    productServiceSpy.getProducts.and.returnValue(signal(products));
    expect(component.featuredProducts()).to.equal(products.slice(0, 4));
  });

  it('should compute featuredServices', () => {
    const services = [
      { id: '1', title: 'Service 1', compatibleBrands: [], compatibleModels: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '2', title: 'Service 2', compatibleBrands: [], compatibleModels: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '3', title: 'Service 3', compatibleBrands: [], compatibleModels: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '4', title: 'Service 4', compatibleBrands: [], compatibleModels: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '5', title: 'Service 5', compatibleBrands: [], compatibleModels: [], createdAt: new Date(), updatedAt: new Date() }
    ];
    serviceItemServiceSpy.getServices.and.returnValue(signal(services));
    expect(component.featuredServices()).to.equal(services.slice(0, 4));
  });
});