import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { InventoryComponent } from './inventory.component';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
/// <reference types="jasmine" />

describe('InventoryComponent', () => {
  let component: InventoryComponent;
  let fixture: ComponentFixture<InventoryComponent>;
  let productServiceSpy: jasmine.SpyObj<ProductService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  beforeEach(async () => {
    const productSpy = jasmine.createSpyObj('ProductService', [], {
      getProducts: jasmine.createSpy().and.returnValue(signal([]))
    });
    const authSpy = jasmine.createSpyObj('AuthService', ['hasRole'], {
      currentUser: jasmine.createSpy().and.returnValue(null)
    });
    const categorySpy = jasmine.createSpyObj('CategoryService', [], {
      getCategories: jasmine.createSpy().and.returnValue(signal([]))
    });

    await TestBed.configureTestingModule({
      imports: [InventoryComponent],
      providers: [
        { provide: ProductService, useValue: productSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: CategoryService, useValue: categorySpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryComponent);
    component = fixture.componentInstance;
    productServiceSpy = TestBed.inject(ProductService) as jasmine.SpyObj<ProductService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    categoryServiceSpy = TestBed.inject(CategoryService) as jasmine.SpyObj<CategoryService>;
  });

  it('should create', () => {
    expect(component).to.be.true;
  });

  it('should compute canAddProducts based on role', () => {
    authServiceSpy.hasRole.and.returnValue(true);
    expect(component.canAddProducts()).to.be.true;

    authServiceSpy.hasRole.and.returnValue(false);
    expect(component.canAddProducts()).to.be.false;
  });

  it('should filter products by search term', () => {
    const products = [
      { id: '1', name: 'Oil Filter', price: 100, stock: 10, compatibleBrands: [], compatibleModels: [], categoryId: 'cat1' },
      { id: '2', name: 'Brake Pad', price: 200, stock: 20, compatibleBrands: [], compatibleModels: [], categoryId: 'cat2' }
    ];
    productServiceSpy.getProducts.and.returnValue(signal(products));

    component.searchTerm.set('oil');
    expect(component.products()).to.equal([products[0]]);
  });

  it('should filter products by category', () => {
    const products = [
      { id: '1', name: 'Oil Filter', price: 100, stock: 10, compatibleBrands: [], compatibleModels: [], categoryId: 'cat1' },
      { id: '2', name: 'Brake Pad', price: 200, stock: 20, compatibleBrands: [], compatibleModels: [], categoryId: 'cat2' }
    ];
    productServiceSpy.getProducts.and.returnValue(signal(products));

    component.selectedCategoryId.set('cat1');
    expect(component.products()).to.equal([products[0]]);
  });

  it('should update search term', () => {
    const event = { target: { value: 'test' } } as any;
    component.updateSearchTerm(event);
    expect(component.searchTerm()).to.equal('test');
  });

  it('should update selected category', () => {
    const event = { target: { value: 'cat1' } } as any;
    component.updateCategory(event);
    expect(component.selectedCategoryId()).to.equal('cat1');
  });

  it('should format currency', () => {
    expect(component.formatCurrency(1000)).to.equal('$1,000');
    expect(component.formatCurrency(undefined)).to.equal('N/A');
  });

  it('should get stock badge class', () => {
    expect(component.getStockBadgeClass(0)).to.equal('bg-red-200 text-red-800');
    expect(component.getStockBadgeClass(5)).to.equal('bg-yellow-200 text-yellow-800');
    expect(component.getStockBadgeClass(20)).to.equal('bg-green-200 text-green-800');
    expect(component.getStockBadgeClass(undefined)).to.equal('bg-gray-200 text-gray-800');
  });
});