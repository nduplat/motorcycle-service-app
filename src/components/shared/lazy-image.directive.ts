import { Directive, ElementRef, Input, OnInit, OnDestroy, Renderer2 } from '@angular/core';

@Directive({
  selector: 'img[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, OnDestroy {
  @Input() appLazyImage = '';
  @Input() placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
  @Input() errorImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2NjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';

  private intersectionObserver?: IntersectionObserver;
  private hasLoaded = false;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Set initial placeholder
    this.renderer.setAttribute(this.el.nativeElement, 'src', this.placeholder);

    // Create intersection observer for lazy loading
    this.createIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  private createIntersectionObserver(): void {
    const options = {
      root: null,
      rootMargin: '50px', // Start loading 50px before the image enters the viewport
      threshold: 0.01
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.hasLoaded) {
          this.loadImage();
        }
      });
    }, options);

    this.intersectionObserver.observe(this.el.nativeElement);
  }

  private loadImage(): void {
    if (this.hasLoaded) return;

    this.hasLoaded = true;
    const img = this.el.nativeElement;

    // Add loading class
    this.renderer.addClass(img, 'lazy-loading');

    // Create a new image to preload
    const preloadImg = new Image();

    preloadImg.onload = () => {
      // Image loaded successfully
      this.renderer.setAttribute(img, 'src', this.appLazyImage);
      this.renderer.removeClass(img, 'lazy-loading');
      this.renderer.addClass(img, 'lazy-loaded');

      // Disconnect observer since image is loaded
      this.intersectionObserver?.disconnect();
    };

    preloadImg.onerror = () => {
      // Image failed to load
      this.renderer.setAttribute(img, 'src', this.errorImage);
      this.renderer.removeClass(img, 'lazy-loading');
      this.renderer.addClass(img, 'lazy-error');

      // Disconnect observer
      this.intersectionObserver?.disconnect();
    };

    // Start loading the image
    preloadImg.src = this.appLazyImage;
  }
}