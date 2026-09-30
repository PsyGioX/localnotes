/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 *
 * Copyright (c) 2026 PsyGioX. Лицензия MIT.
 * Исходники: https://github.com/PsyGioX/localnotes — Сайт: https://localnotes-three.vercel.app
 */
// Performance monitoring and optimization utilities
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.startTime = performance.now();
        this.init();
    }

    init() {
        // Monitor Core Web Vitals
        this.observeLCP();
        this.observeFID();
        this.observeCLS();
        
        // Monitor resource loading
        this.monitorResourceLoading();
        
        // Monitor memory usage
        this.monitorMemoryUsage();
    }

    // Largest Contentful Paint
    observeLCP() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.lcp = lastEntry.startTime;
            });
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
        }
    }

    // First Input Delay
    observeFID() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    this.metrics.fid = entry.processingStart - entry.startTime;
                });
            });
            observer.observe({ entryTypes: ['first-input'] });
        }
    }

    // Cumulative Layout Shift
    observeCLS() {
        if ('PerformanceObserver' in window) {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                this.metrics.cls = clsValue;
            });
            observer.observe({ entryTypes: ['layout-shift'] });
        }
    }

    // Monitor resource loading performance
    monitorResourceLoading() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    // Only warn for resources taking more than 2 seconds and not TinyMCE plugins
                    if (entry.duration > 2000 && !entry.name.includes('editor_news/plugins/')) {
                        console.warn('Slow resource:', entry.name, entry.duration + 'ms');
                    }
                });
            });
            observer.observe({ entryTypes: ['resource'] });
        }
    }

    // Monitor memory usage
    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.metrics.memory = {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit
                };
                
                // Warn if memory usage is high
                if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
                    console.warn('High memory usage:', Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB');
                }
            }, 30000); // Check every 30 seconds
        }
    }

    // Get performance metrics
    getMetrics() {
        return {
            ...this.metrics,
            loadTime: performance.now() - this.startTime,
            navigation: performance.getEntriesByType('navigation')[0]
        };
    }

    // Report metrics to analytics
    reportMetrics() {
        const metrics = this.getMetrics();
        
        // Send to Google Analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'performance_metrics', {
                lcp: Math.round(metrics.lcp || 0),
                fid: Math.round(metrics.fid || 0),
                cls: Math.round((metrics.cls || 0) * 1000),
                load_time: Math.round(metrics.loadTime)
            });
        }
    }
}

// Lazy loading utility
class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadElement(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
        }
    }

    observe(element) {
        if (this.observer) {
            this.observer.observe(element);
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadElement(element);
        }
    }

    loadElement(element) {
        const src = element.dataset.src;
        if (src) {
            if (element.tagName === 'IMG') {
                element.src = src;
            } else if (element.tagName === 'IFRAME') {
                element.src = src;
            }
            element.classList.add('loaded');
        }
    }
}

// Image optimization utility
class ImageOptimizer {
    constructor() {
        this.supportedFormats = this.checkWebPSupport();
    }

    checkWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    optimizeImage(img) {
        // Add loading="lazy" if not present
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }

        // Add decoding="async" for better performance
        if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }

        // Convert to WebP if supported
        if (this.supportedFormats && img.src && !img.src.includes('.webp')) {
            const webpSrc = img.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            img.src = webpSrc;
        }
    }

    optimizeAllImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => this.optimizeImage(img));
    }
}

// Initialize performance monitoring
let performanceMonitor;
let lazyLoader;
let imageOptimizer;

document.addEventListener('DOMContentLoaded', function() {
    performanceMonitor = new PerformanceMonitor();
    lazyLoader = new LazyLoader();
    imageOptimizer = new ImageOptimizer();
    
    // Optimize existing images
    imageOptimizer.optimizeAllImages();
    
    // Report metrics after page load
    window.addEventListener('load', function() {
        setTimeout(() => {
            performanceMonitor.reportMetrics();
        }, 2000);
    });
});

// Export for use in other modules
window.PerformanceMonitor = PerformanceMonitor;
window.LazyLoader = LazyLoader;
window.ImageOptimizer = ImageOptimizer;
