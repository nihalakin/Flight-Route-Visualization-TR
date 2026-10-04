"""
Migration script to fix incorrectly categorized liked aspects in dataset analysis results.

This script separates cleanliness-related items from comfort-related items that were
incorrectly merged under wrong categories.

Usage:
    cd c:\Users\Huawei\Desktop\Nodia 30.03 - Kopya - Kopya - Kopya
    python scripts/migrate_fix_categories.py
"""

import sys
import re
from typing import List, Dict, Tuple

# Add parent directory to path for imports
sys.path.insert(0, 'c:\\Users\\Huawei\\Desktop\\Nodia 30.03 - Kopya - Kopya - Kopya')

from app.db.database import SessionLocal
from app.models.airline_dataset_review import AirlineDatasetAnalysis


# Keyword patterns for categorization
CLEANLINESS_KEYWORDS = [
    r'temiz', r'hijyen', r'bakım', r'bakımlı', r'düzen', r'düzenli', r'düzgün',
    r'pis', r'kirli', r'temizlik', r'tuvalet', r'wc', r'lavabo'
]

COMFORT_KEYWORDS = [
    r'konfor', r'rahat', r'rahatlık', r'koltuk genişliği', r'koltuk aralığı',
    r'bacak mesafesi', r'yastık', r'battaniye', r'uzun uçuş', r'uçuşun rahat',
    r'uçuşun konforlu', r'genel uçuş deneyimi', r'keyifli uçuş'
]

TIMELINESS_KEYWORDS = [
    r'zamanında', r'rötar', r'gecikme', r'gecikmeli', r'geç kalk', r'geç ini',
    r'erteleme', r'bilgilendirme', r'duyuru', r'anons', r'kapı değişikliği'
]

NETWORK_KEYWORDS = [
    r'uçuş ağı', r'rota', r'çok uçuş noktası', r'ulaşılabilirlik', r'geniş ağ'
]

SAFETY_KEYWORDS = [
    r'güvenlik', r'güvenli', r'emniyet', r'güvenlik standard', r'güvenli hisset'
]


def detect_category(text: str) -> str:
    """
    Detect the correct category for a given text based on keywords.
    Returns the category name or empty string if unclear.
    """
    text_lower = text.lower()
    
    # Check each category
    cleanliness_score = sum(1 for kw in CLEANLINESS_KEYWORDS if re.search(kw, text_lower))
    comfort_score = sum(1 for kw in COMFORT_KEYWORDS if re.search(kw, text_lower))
    timeliness_score = sum(1 for kw in TIMELINESS_KEYWORDS if re.search(kw, text_lower))
    network_score = sum(1 for kw in NETWORK_KEYWORDS if re.search(kw, text_lower))
    safety_score = sum(1 for kw in SAFETY_KEYWORDS if re.search(kw, text_lower))
    
    scores = {
        'cleanliness': cleanliness_score,
        'comfort': comfort_score,
        'timeliness': timeliness_score,
        'network': network_score,
        'safety': safety_score
    }
    
    # Get the highest scoring category
    max_category = max(scores, key=scores.get)
    max_score = scores[max_category]
    
    # If no clear match, return empty
    if max_score == 0:
        return ''
    
    return max_category


def parse_aspect(aspect: str) -> Tuple[str, str]:
    """
    Parse an aspect string into (title, description).
    Format: "Title: Description" or just "Title"
    """
    if ':' in aspect:
        idx = aspect.index(':')
        title = aspect[:idx].strip()
        desc = aspect[idx + 1:].strip()
        return title, desc
    return aspect.strip(), ''


def rebuild_aspect(title: str, desc: str) -> str:
    """Rebuild aspect string from title and description."""
    if desc:
        return f"{title}: {desc}"
    return title


def categorize_aspects(aspects: List[str]) -> Dict[str, List[str]]:
    """
    Categorize all aspects into their correct categories.
    Returns a dict with category names as keys.
    """
    categories = {
        'Zamanında Uçuş': [],
        'Keyifli ve Rahat Bir Uçuş': [],
        'Uçakların Temiz ve Düzenli Olması': [],
        'Uçuş Ağı': [],
        'Güvenlik': [],
        'Diğer': []
    }
    
    for aspect in aspects:
        if not aspect or not isinstance(aspect, str):
            continue
            
        title, desc = parse_aspect(aspect)
        full_text = f"{title} {desc}"
        
        detected = detect_category(full_text)
        
        # Map internal category names to display names
        category_map = {
            'timeliness': 'Zamanında Uçuş',
            'comfort': 'Keyifli ve Rahat Bir Uçuş',
            'cleanliness': 'Uçakların Temiz ve Düzenli Olması',
            'network': 'Uçuş Ağı',
            'safety': 'Güvenlik',
            '': 'Diğer'
        }
        
        target_category = category_map.get(detected, 'Diğer')
        
        # Rebuild the aspect with correct title if needed
        if detected == 'cleanliness' and title not in ['Uçakların Temiz ve Düzenli Olması']:
            new_aspect = rebuild_aspect('Uçakların Temiz ve Düzenli Olması', desc or title)
            categories[target_category].append(new_aspect)
        elif detected == 'comfort' and title not in ['Keyifli ve Rahat Bir Uçuş']:
            new_aspect = rebuild_aspect('Keyifli ve Rahat Bir Uçuş', desc or title)
            categories[target_category].append(new_aspect)
        elif detected == 'timeliness' and title not in ['Zamanında Uçuş']:
            new_aspect = rebuild_aspect('Zamanında Uçuş', desc or title)
            categories[target_category].append(new_aspect)
        else:
            categories[target_category].append(aspect)
    
    return categories


def merge_same_category_items(categories: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """
    Merge items with the same title within each category.
    """
    result = {}
    
    for category, items in categories.items():
        if not items:
            continue
            
        # Group by title
        by_title: Dict[str, List[str]] = {}
        
        for item in items:
            title, desc = parse_aspect(item)
            if title not in by_title:
                by_title[title] = []
            if desc:
                by_title[title].append(desc)
        
        # Merge descriptions for same title
        merged = []
        for title, descs in by_title.items():
            if descs:
                # Remove duplicates while preserving order
                seen = set()
                unique_descs = []
                for d in descs:
                    d_clean = d.lower().strip()
                    if d_clean not in seen:
                        seen.add(d_clean)
                        unique_descs.append(d)
                
                merged_desc = '\n'.join(unique_descs)
                merged.append(rebuild_aspect(title, merged_desc))
            else:
                merged.append(title)
        
        result[category] = merged
    
    return result


def flatten_categories(categories: Dict[str, List[str]]) -> List[str]:
    """
    Flatten categorized items back to a list, maintaining category order.
    """
    result = []
    order = ['Zamanında Uçuş', 'Keyifli ve Rahat Bir Uçuş', 'Uçakların Temiz ve Düzenli Olması', 
             'Uçuş Ağı', 'Güvenlik', 'Diğer']
    
    for cat in order:
        if cat in categories and categories[cat]:
            result.extend(categories[cat])
    
    return result


def migrate_analysis(analysis: AirlineDatasetAnalysis) -> bool:
    """
    Migrate a single analysis record. Returns True if changes were made.
    """
    original_aspects = analysis.most_liked_aspects or []
    
    if not original_aspects:
        return False
    
    print(f"\nProcessing analysis for: {analysis.airline_name}")
    print(f"Original aspects count: {len(original_aspects)}")
    
    # Step 1: Categorize all aspects
    categorized = categorize_aspects(original_aspects)
    
    # Step 2: Merge same-title items within each category
    merged = merge_same_category_items(categorized)
    
    # Step 3: Flatten back to list
    new_aspects = flatten_categories(merged)
    
    print(f"New aspects count: {len(new_aspects)}")
    print("\nCategory breakdown:")
    for cat, items in merged.items():
        if items:
            print(f"  {cat}: {len(items)} items")
    
    # Check if changes were made
    if new_aspects != original_aspects:
        analysis.most_liked_aspects = new_aspects
        return True
    
    return False


def main():
    """Main migration function."""
    print("=" * 60)
    print("Dataset Analysis Category Migration Script")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get all analysis records
        analyses = db.query(AirlineDatasetAnalysis).all()
        print(f"\nFound {len(analyses)} analysis records to process")
        
        updated_count = 0
        
        for analysis in analyses:
            try:
                if migrate_analysis(analysis):
                    updated_count += 1
                    print("  ✓ Changes made - will be saved")
                else:
                    print("  - No changes needed")
            except Exception as e:
                print(f"  ✗ Error processing: {e}")
                continue
        
        # Commit all changes
        if updated_count > 0:
            print(f"\n{'=' * 60}")
            print(f"Committing {updated_count} updated records...")
            db.commit()
            print("✓ Migration completed successfully!")
        else:
            print("\nNo records needed updating.")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
