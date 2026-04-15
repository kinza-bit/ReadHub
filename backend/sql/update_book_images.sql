-- update_book_images.sql
-- Sets ImageURL for all existing books to match the actual files in BooksIMG/
-- Run this ONCE against Read_Hub to populate the image paths.

USE Read_Hub;

-- Engineering
UPDATE Books SET ImageURL = '/images/engineering Economics.jpeg'
WHERE Title = 'Engineering Economy';

UPDATE Books SET ImageURL = '/images/ControlSystemEngineering.jpeg'
WHERE Title = 'Control Systems Engineering';

UPDATE Books SET ImageURL = '/images/MDAC.jpeg'
WHERE Title = 'Modern Digital and Analog Communication Systems';

UPDATE Books SET ImageURL = '/images/fundalmentalof thermodynamics.jpeg'
WHERE Title = 'Fundamentals of Thermodynamics';

UPDATE Books SET ImageURL = '/images/EmbeddedSystem.jpeg'
WHERE Title LIKE '%PIC Microcontroller%';

-- Horror
UPDATE Books SET ImageURL = '/images/mostlyDarkjpeg.jpeg'
WHERE Title LIKE '%Mostly Dark%';

UPDATE Books SET ImageURL = '/images/Resurrection.jpeg'
WHERE Title LIKE '%Resurrection%';

UPDATE Books SET ImageURL = '/images/theKillingComplex.jpeg'
WHERE Title LIKE '%Killing Complex%';

UPDATE Books SET ImageURL = '/images/Reaper.jpeg'
WHERE Title LIKE '%Reaper of Washington%';

UPDATE Books SET ImageURL = '/images/Dracula.jpeg'
WHERE Title = 'Dracula';

-- Verify
SELECT BookID, Title, ImageURL FROM Books ORDER BY BookID;
